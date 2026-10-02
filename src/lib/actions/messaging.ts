'use server';

import { revalidatePath } from 'next/cache';
import { getAdminAuth } from '@/lib/supabase/admin-auth';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import {
  audienceCounts,
  markAllRead,
  markRead,
  notifyCustomers,
} from '@/lib/supabase/notifications';
import { sendMail } from '@/lib/mail/send';
import { renderTemplate, escapeHtml } from '@/lib/mail/templates';
import { siteOrigin } from '@/lib/site-origin';
import { contentService } from '@/lib/services/content-service';
import type { MailAttachment } from '@/lib/mail/types';

/**
 * Messaging: in-app notifications and operator broadcasts.
 *
 * Two audiences, two very different trust models:
 *
 *  - `markNotificationsRead` runs for a signed-in shopper and is scoped by RLS on
 *    `notifications`, which resolves the recipient from the session rather than
 *    from anything posted. It cannot be pointed at somebody else's notification.
 *  - `sendBroadcast` is an admin action. It sends to a list rather than to
 *    people, so the interesting failure modes are exhaustion (mail-bombing a
 *    list) and accidental disclosure (sending the internal note to everybody).
 *    Both are handled below rather than left to care.
 */

export interface MessageResult {
  ok: boolean;
  message: string;
  /** Numbers worth showing back to the operator after a send. */
  detail?: { attempted: number; sent: number; failed: number; notified: number };
}

function asString(value: FormDataEntryValue | null, max = 20_000): string {
  return String(value ?? '').trim().slice(0, max);
}

/* ------------------------------------------------------------------ */
/* Customer: read state                                                */
/* ------------------------------------------------------------------ */

export async function markNotificationsRead(ids: string[]): Promise<number> {
  // Sanitised rather than passed through: these ids end up in a `.in()` filter,
  // and an unbounded list from a tampered client is a very large query.
  const safe = ids
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= 64)
    .slice(0, 100);

  return markRead(safe);
}

export async function markEveryNotificationRead(): Promise<number> {
  return markAllRead();
}

/* ------------------------------------------------------------------ */
/* Admin: compose                                                      */
/* ------------------------------------------------------------------ */

export async function getAudienceCounts(): Promise<{ customers: number; subscribers: number }> {
  return audienceCounts();
}

const MAX_RECIPIENTS = 5_000;

/**
 * Sends one message to a chosen audience.
 *
 * ## Why this is not a fire-and-forget loop
 *
 * A naive implementation reads every address and POSTs one request per recipient
 * inside the Server Action. Three things go wrong: the request times out and the
 * action is retried, sending duplicates; a partial failure leaves the operator
 * with no record of who got it; and an unbounded list is an accidental
 * mail-bomb, which will get the sending domain suspended.
 *
 * So the send is capped, logged per recipient, and reported back with counts that
 * can be compared against the audience size. A cap that is *stated* is safer
 * than no cap: an operator who hits it finds out why.
 */
export async function sendBroadcast(
  _prev: MessageResult | null,
  formData: FormData,
): Promise<MessageResult> {
  const auth = await getAdminAuth();
  if (!auth.authenticated) {
    return { ok: false, message: 'You are not authorised to perform this action.' };
  }

  const audience = asString(formData.get('audience'), 20) || 'subscribers';
  const subject = asString(formData.get('subject'), 200);
  const body = asString(formData.get('body'), 20_000);
  const imageId = asString(formData.get('image_id'), 64) || null;
  const alsoNotify = formData.get('also_notify') === 'on';
  const previewOnly = formData.get('preview_only') === 'on';

  if (!subject) return { ok: false, message: 'A subject is required.' };
  if (!body) return { ok: false, message: 'Write a message before sending.' };

  const admin = createAdminSupabaseClient();
  if (!admin) return { ok: false, message: 'Supabase is not configured.' };

  /*
   * Subscriber addresses.
   *
   * The unsubscribe token is selected here, on the service role, even though it
   * is never returned to the caller. That is the only place it can be read now
   * that anon cannot, and it is needed to build a compliant footer link.
   */
  const wantsSubscribers = audience === 'subscribers' || audience === 'both';
  const wantsCustomers = audience === 'customers' || audience === 'both';

  const recipients: { email: string; unsubscribeToken: string | null }[] = [];

  if (wantsSubscribers) {
    const { data, error } = await admin
      .from('newsletter_subscribers')
      .select('email, unsubscribe_token')
      .is('unsubscribed_at', null)
      .limit(MAX_RECIPIENTS + 1);

    if (error) return { ok: false, message: `Could not read the list: ${error.message}` };
    for (const row of data ?? []) {
      recipients.push({ email: row.email, unsubscribeToken: row.unsubscribe_token });
    }
  }

  if (wantsCustomers) {
    const { data, error } = await admin
      .from('customers')
      .select('email')
      .limit(MAX_RECIPIENTS + 1);

    if (error) return { ok: false, message: `Could not read customers: ${error.message}` };
    for (const row of data ?? []) {
      if (row.email && !recipients.some((r) => r.email === row.email)) {
        // Customers get no unsubscribe footer: this is a service message to
        // people who made an account, not marketing to a mailing list. Mixing
        // the two is how a transactional list ends up treated as consented.
        recipients.push({ email: row.email, unsubscribeToken: null });
      }
    }
  }

  if (recipients.length === 0) {
    return { ok: false, message: 'That audience has nobody on it yet.' };
  }

  const overCap = recipients.length > MAX_RECIPIENTS;
  const sendList = overCap ? recipients.slice(0, MAX_RECIPIENTS) : recipients;

  // The chosen artwork, embedded by public URL and attached as a file.
  let imageUrl: string | null = null;
  let attachment: MailAttachment[] | undefined;

  if (imageId) {
    const { data: image } = await admin
      .from('images')
      .select('url, storage_path, alt')
      .eq('id', imageId)
      .maybeSingle<{ url: string; storage_path: string | null; alt: string | null }>();

    if (image?.url) imageUrl = image.url;

    if (image?.storage_path) {
      const { data: file } = await admin.storage
        .from('media')
        .download(image.storage_path);

      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        attachment = [
          {
            filename: image.storage_path.split('/').pop() ?? 'image',
            content: buffer.toString('base64'),
            contentType: file.type || 'application/octet-stream',
          },
        ];
      }
    }
  }

  const origin = await siteOrigin();
  const siteUrl = origin ?? '';
  const settings = await contentService.getSettings().catch(() => null);
  const shopName = settings?.brandName?.trim() || 'the shop';

  /*
   * Built as a set of balanced blocks rather than by concatenation.
   *
   * The previous version opened `<p style="margin-top:32px">`, then `<hr>`, then a
   * second `<p>`, and relied on a single trailing `</p>` per recipient to tidy it
   * up — so the first paragraph was never closed, and the unsubscribe link
   * landed inside the "Sent by" paragraph. Mail clients parse this defensively,
   * which is exactly why the bug survived: it renders *almost* right.
   *
   * Every block is now self-contained. The body is escaped rather than
   * interpolated raw: it comes from an admin, so this is not an injection risk,
   * but a stray `<` in the copy should not be able to restructure the footer it
   * is pasted next to.
   */
  const bodyHtml = escapeHtml(renderTemplate(body, {})).replace(/\n/g, '<br>');
  const html = [
    imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="" style="max-width:100%;height:auto;border-radius:8px;margin-bottom:24px">`
      : '',
    `<p>${bodyHtml}</p>`,
    '<hr style="border:none;border-top:1px solid #e5e1d8;margin:32px 0 16px">',
    `<p style="font-size:12px;color:#6b665c">Sent by ${escapeHtml(shopName)}.</p>`,
  ].join('');

  const isPreview = previewOnly;
  const sendTarget = isPreview ? 'preview@example.invalid' : null;

  let sent = 0;
  let failed = 0;

  if (sendTarget) {
    const result = await sendMail(
      { to: sendTarget, subject, html, text: body, attachments: attachment },
      { event: 'admin.broadcast' },
    );
    if (result.ok) sent += 1;
    else failed += 1;

    return {
      ok: result.ok,
      message: result.ok
        ? 'Sent one preview to the server log. Nothing was sent to the list.'
        : `Preview failed: ${result.detail}`,
      detail: { attempted: 1, sent, failed, notified: 0 },
    };
  }

  /*
   * Sequential rather than parallel.
   *
   * Firing thousands of concurrent requests at a provider is how you get
   * rate-limited halfway through, and a rate-limited provider returns 429 for
   * the rest of the batch — so a parallel send fails *more* than a slow one.
   * Sequential also makes the count below trustworthy.
   */
  for (const recipient of sendList) {
    const unsubscribe = recipient.unsubscribeToken
      ? `<p><a href="${siteUrl}/newsletter/unsubscribe?token=${encodeURIComponent(
          recipient.unsubscribeToken,
        )}" style="color:#6b665c;font-size:12px">Unsubscribe</a></p>`
      : '';

    const result = await sendMail(
      {
        to: recipient.email,
        subject,
        // The footer closes itself now, so the per-recipient addition is its own
        // block rather than a tag that has to balance against the shared markup.
        html: `${html}${unsubscribe}`,
        text: `${body}\n\n${
          recipient.unsubscribeToken
            ? `Unsubscribe: ${siteUrl}/newsletter/unsubscribe?token=${recipient.unsubscribeToken}`
            : ''
        }`,
        attachments: attachment,
      },
      { event: 'admin.broadcast' },
    );

    if (result.ok) sent += 1;
    else failed += 1;
  }

  let notified = 0;
  if (alsoNotify && wantsCustomers) {
    const result = await notifyCustomers({
      customerIds: null,
      title: subject.slice(0, 160),
      body: body.slice(0, 2000),
      imageId,
      link: null,
    });
    if (result.ok) notified = result.delivered;
  }

  revalidatePath('/admin/messaging');

  const capNote = overCap
    ? ` The list is longer than ${MAX_RECIPIENTS}, so the remainder was not sent — split it or use a bulk tool.`
    : '';

  return {
    ok: failed === 0,
    message:
      `Sent ${sent} of ${sendList.length}.` +
      (failed > 0 ? ` ${failed} failed — see the email log.` : '') +
      (notified > 0 ? ` ${notified} in-app notifications created.` : '') +
      capNote,
    detail: { attempted: sendList.length, sent, failed, notified },
  };
}

/** Sends a single message to the operator's own address, to prove it works. */
export async function sendTestEmail(
  _prev: MessageResult | null,
  formData: FormData,
): Promise<MessageResult> {
  const auth = await getAdminAuth();
  if (!auth.authenticated) {
    return { ok: false, message: 'You are not authorised to perform this action.' };
  }

  const to = asString(formData.get('to'), 200).toLowerCase();
  const subject = asString(formData.get('subject'), 200) || 'Test email from the shop admin';
  const body =
    asString(formData.get('body'), 10_000) ||
    'This is a test message confirming the email provider is working.';

  if (!to || !to.includes('@')) {
    return { ok: false, message: 'Enter a valid address to send the test to.' };
  }

  const result = await sendMail(
    { to, subject, html: `<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>`, text: body },
    { event: 'admin.test' },
  );

  return {
    ok: result.ok,
    message: result.ok ? `Sent to ${to}. ${result.detail}` : `Not sent. ${result.detail}`,
    detail: { attempted: 1, sent: result.ok ? 1 : 0, failed: result.ok ? 0 : 1, notified: 0 },
  };
}