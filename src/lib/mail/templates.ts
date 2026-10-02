import { createAdminSupabaseClient } from '@/lib/supabase/admin';

/**
 * Template rendering and the automation registry.
 *
 * ## Substitution is over an explicit allowlist, not a global replace
 *
 * The obvious implementation is `body.replace(/\{\{(\w+)\}\}/g, (m, key) => data[key] ?? '')`,
 * which resolves *any* token found in the template. That is wrong in a specific
 * way: a shopper's own name — "Hi {{order_total}}" — would be substituted, and
 * the merge tag would leak whatever value happened to match.
 *
 * So the caller passes the keys it intends, and only those are substituted. A
 * token the caller did not name is left as-is, which is also better for the
 * operator: an unresolved `{{first_name}}` is visible in the preview rather than
 * silently blanked.
 */

export type TemplateVars = Record<string, string | number | null | undefined>;

export function renderTemplate(template: string, vars: TemplateVars): string {
  let out = template;

  for (const [key, value] of Object.entries(vars)) {
    // Only `{{ key }}` with optional inner padding, and only for keys the
    // caller named. `split`/`join` avoids the `$&`-style surprises that come
    // with a replacement callback and a value containing the pattern.
    const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, 'g');
    out = out.split(pattern).join(value == null ? '' : String(value));
  }

  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Escapes text for interpolation into the HTML bodies. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailTemplate {
  key: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  enabled: boolean;
}

export type TemplateLookupResult =
  | { ok: true; template: EmailTemplate }
  | { ok: false; reason: 'not-configured' | 'disabled' | 'unknown'; message: string };

/**
 * Loads a template and renders it.
 *
 * When the stored subject or body contains `{{token}}`, the token is escaped
 * before substitution unless the caller marks it safe. That keeps a value like a
 * customer's name from being able to close a tag and inject markup into an
 * email — a real concern, because the customer's name comes from a form.
 */
export async function renderEmailTemplate(
  key: string,
  vars: TemplateVars,
  options: { safe?: string[] } = {},
): Promise<
  | { ok: true; subject: string; html: string; text: string }
  | { ok: false; reason: string; message: string }
> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return { ok: false, reason: 'not-configured', message: 'Supabase is not configured.' };
  }

  const { data } = await admin
    .from('email_templates')
    .select('key, subject, body_html, body_text, enabled')
    .eq('key', key)
    .maybeSingle<EmailTemplate>();

  if (!data) {
    return { ok: false, reason: 'unknown', message: `No email template called "${key}".` };
  }
  if (!data.enabled) {
    return { ok: false, reason: 'disabled', message: `The "${key}" template is switched off.` };
  }

  const safe = new Set(options.safe ?? []);
  const prepared: TemplateVars = {};
  for (const [name, value] of Object.entries(vars)) {
    const asText = value == null ? '' : String(value);
    prepared[name] = safe.has(name) ? asText : escapeHtml(asText);
  }

  return {
    ok: true,
    subject: renderTemplate(data.subject, prepared),
    html: renderTemplate(data.bodyHtml, prepared),
    text: renderTemplate(data.bodyText, prepared),
  };
}

/* ------------------------------------------------------------------ */
/* Automation registry                                                 */
/* ------------------------------------------------------------------ */

/**
 * The events the app can fire.
 *
 * A closed list rather than a free string, so a typo in an event name is a
 * compile error instead of an automation that silently never fires.
 */
export const EMAIL_EVENTS = {
  SIGNUP: 'user.signup',
  PASSWORD_RESET: 'user.password_reset',
  ORDER_PLACED: 'order.placed',
  ORDER_DISPATCHED: 'order.dispatched',
  ORDER_DELIVERED: 'order.delivered',
  SUBSCRIBER_SUBSCRIBED: 'subscriber.subscribed',
  ADMIN_BROADCAST: 'admin.broadcast',
} as const;

export type EmailEvent = (typeof EMAIL_EVENTS)[keyof typeof EMAIL_EVENTS];

export interface AutomationState {
  event: string;
  templateKey: string;
  enabled: boolean;
}

/** Reads every automation, for the admin list. */
export async function listAutomations(): Promise<AutomationState[]> {
  const admin = createAdminSupabaseClient();
  if (!admin) return [];

  const { data } = await admin
    .from('email_automations')
    .select('event, template_key, enabled')
    .order('event');

  if (!data) return [];

  return data.map((row) => ({
    event: row.event,
    templateKey: row.template_key,
    enabled: row.enabled,
  }));
}

/** Lists templates for the admin editor. */
export async function listTemplates(): Promise<EmailTemplate[]> {
  const admin = createAdminSupabaseClient();
  if (!admin) return [];

  const { data } = await admin
    .from('email_templates')
    .select('key, subject, body_html, body_text, enabled')
    .order('key');

  if (!data) return [];

  return data.map((row) => ({
    key: row.key,
    subject: row.subject,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    enabled: row.enabled,
  }));
}

export type SaveTemplateResult = { ok: true } | { ok: false; message: string };

export async function saveTemplate(input: {
  key: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  enabled: boolean;
  adminUserId: string | null;
}): Promise<SaveTemplateResult> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { ok: false, message: 'Supabase is not configured.' };

  const subject = input.subject.trim();
  if (!subject) return { ok: false, message: 'A subject line is required.' };

  // The key is the contract between a trigger and a template, so it is
  // validated against the same shape the migration enforces rather than trusted.
  if (!/^[a-z0-9_]{1,60}$/.test(input.key)) {
    return { ok: false, message: 'A template key may only contain lowercase letters, digits and underscores.' };
  }

  const { error } = await admin.from('email_templates').upsert({
    key: input.key,
    subject,
    body_html: input.bodyHtml,
    body_text: input.bodyText,
    enabled: input.enabled,
    updated_by: input.adminUserId,
    updated_at: new Date().toISOString(),
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export type SaveAutomationResult = { ok: true } | { ok: false; message: string };

export async function setAutomationEnabled(
  event: string,
  enabled: boolean,
): Promise<SaveAutomationResult> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { ok: false, message: 'Supabase is not configured.' };

  const { error } = await admin
    .from('email_automations')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('event', event);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/**
 * Triggers the automation bound to `event`, if one is enabled.
 *
 * Returns a reason instead of throwing when the automation is off or missing.
 * That is deliberate: "we did not email them" is a legitimate configuration, and
 * a caller should be able to carry on placing an order without treating a
 * disabled confirmation as a failure.
 */
export async function triggerAutomation(
  event: string,
  to: string,
  vars: TemplateVars,
  options: { attachments?: MailAttachment[]; safe?: string[] } = {},
): Promise<{ sent: boolean; reason?: string; detail?: string }> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { sent: false, reason: 'not-configured' };

  const { data } = await admin
    .from('email_automations')
    .select('template_key, enabled')
    .eq('event', event)
    .maybeSingle<{ template_key: string; enabled: boolean }>();

  if (!data) return { sent: false, reason: 'no-automation' };
  if (!data.enabled) return { sent: false, reason: 'disabled' };

  const rendered = await renderEmailTemplate(data.template_key, vars, { safe: options.safe });
  if (!rendered.ok) return { sent: false, reason: rendered.reason, detail: rendered.message };

  const { sendMail } = await import('./send');
  const result = await sendMail(
    {
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      attachments: options.attachments,
      tags: { automation: event },
    },
    { event, record: true },
  );

  return { sent: result.ok, reason: result.failure, detail: result.detail };
}

import type { MailAttachment } from './types';