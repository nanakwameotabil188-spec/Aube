import type { MailMessage, MailProvider, MailResult } from './types';

/**
 * Mail providers.
 *
 * ## Dependency-free on purpose
 *
 * Resend, Postmark and the console driver are plain HTTPS calls, implemented
 * with `fetch`. That is a deliberate trade: the obvious alternative is adding a
 * provider SDK per vendor, and every one of those is a dependency that has to be
 * kept current, audited, and — for the ones that need native modules — compiled.
 *
 * For two JSON endpoints the surface area of an SDK is mostly larger than the
 * request it makes.
 *
 * ## Why there is no SMTP driver
 *
 * Generic SMTP needs `nodemailer` plus a TLS story, and there is no way to test
 * it here: an SMTP server, credentials and a deliverability check are all needed
 * before the first line can be called working. Shipping it untested would mean
 * offering a provider in the admin picker that cannot be verified.
 *
 * It is the obvious next addition and belongs in this file as a ~60-line
 * adapter once there is a server to point it at.
 */

const TIMEOUT_MS = 15_000;

/** A fetch with a timeout, so a hung provider cannot pin a request open. */
async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<{ ok: boolean; status: number; json: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      // A non-JSON body from an API is a proxy error page more often than
      // anything else, and the raw text is what identifies it.
    }

    return { ok: response.ok, status: response.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

interface JsonRecord {
  [key: string]: unknown;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

/** Pulls a human-usable error out of a provider's several error conventions. */
function describeFailure(json: unknown, text: string): string {
  if (isRecord(json)) {
    for (const key of ['message', 'error', 'detail', 'name']) {
      const value = json[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      return json.errors
        .map((entry) => (isRecord(entry) ? String(entry.message ?? entry.code ?? '') : String(entry)))
        .filter(Boolean)
        .join('; ');
    }
  }
  return text.slice(0, 300) || 'no response body';
}

function isAuthFailure(status: number): boolean {
  return status === 401 || status === 403;
}

/* ------------------------------------------------------------------ */
/* Console                                                             */
/* ------------------------------------------------------------------ */

/**
 * Writes the message to the server log instead of sending it.
 *
 * This is the provider that makes the rest of the system testable. Without it,
 * every email path could only be exercised by sending real mail to a real
 * inbox, which is not something a test suite should do and not something an
 * operator wants to do before they have chosen a vendor.
 *
 * It is selectable in the admin panel rather than being a silent fallback,
 * because "no provider" and "log only" are genuinely different intentions and
 * only one of them is a mistake.
 */
export const consoleProvider: MailProvider = {
  id: 'console',
  requiresSecrets: false,

  async send(message: MailMessage): Promise<MailResult> {
    const preview = [
      '',
      '='.repeat(72),
      `EMAIL (console driver — not sent)`,
      `  to:      ${message.to}`,
      `  from:    ${message.fromName ? `${message.fromName} <${message.from}>` : (message.from ?? '(unset)')}`,
      `  subject: ${message.subject}`,
    ];

    if (message.attachments?.length) {
      preview.push(`  attachments: ${message.attachments.length}`);
      for (const file of message.attachments) {
        preview.push(`    - ${file.filename} (${file.contentType}, ${file.content.length} b64 chars)`);
      }
    }

    const body = message.text ?? stripTags(message.html ?? '');
    preview.push('-'.repeat(72));
    preview.push(body.slice(0, 2000));
    preview.push('='.repeat(72));

    // Server console only. This must never be reachable from the browser, and
    // it is not: the provider table is server-side and this module is imported
    // only by server code.
    console.log(preview.join('\n'));

    return {
      ok: true,
      provider: 'console',
      detail: `logged instead of sent (${body.length} characters of body)`,
      id: 'console',
    };
  },

  async verify(): Promise<MailResult> {
    return {
      ok: true,
      provider: 'console',
      detail: 'The console driver is always available. It logs messages instead of sending them.',
    };
  },
};

/** A very small tag stripper, only used to make the log readable. */
function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ------------------------------------------------------------------ */
/* Resend                                                              */
/* ------------------------------------------------------------------ */

export const resendProvider: MailProvider = {
  id: 'resend',
  requiresSecrets: true,

  async send(message: MailMessage, secrets): Promise<MailResult> {
    const apiKey = secrets.api_key;
    if (!apiKey) {
      return { ok: false, provider: 'resend', detail: 'No API key stored.', failure: 'not-configured' };
    }

    const from = message.from
      ? `${message.fromName ? `${message.fromName} ` : ''}<${message.from}>`
      : undefined;

    const payload: JsonRecord = {
      to: [message.to],
      subject: message.subject,
    };
    if (from) payload.from = from;
    if (message.html) payload.html = message.html;
    if (message.text) payload.text = message.text;
    if (message.replyTo) payload.reply_to = message.replyTo;
    if (message.tags) payload.tags = Object.entries(message.tags).map(([name, value]) => ({ name, value }));
    if (message.attachments?.length) {
      payload.attachments = message.attachments.map((file) => ({
        filename: file.filename,
        content: file.content,
      }));
    }

    const response = await postJson(
      'https://api.resend.com/emails',
      { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      payload,
    );

    if (!response.ok) {
      return {
        ok: false,
        provider: 'resend',
        detail: `${describeFailure(response.json, response.text)} (HTTP ${response.status})`,
        failure: isAuthFailure(response.status) ? 'bad-credentials' : 'rejected',
      };
    }

    const id = isRecord(response.json) && typeof response.json.id === 'string' ? response.json.id : undefined;
    return { ok: true, provider: 'resend', detail: 'accepted by Resend', id };
  },

  async verify(secrets): Promise<MailResult> {
    if (!secrets.api_key) {
      return { ok: false, provider: 'resend', detail: 'No API key stored.', failure: 'not-configured' };
    }

    // `domains` is read-only, so verifying does not create or send anything.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${secrets.api_key}` },
        signal: controller.signal,
      });
      const text = await response.text();

      if (!response.ok) {
        return {
          ok: false,
          provider: 'resend',
          detail: `${describeFailure(null, text)} (HTTP ${response.status})`,
          failure: isAuthFailure(response.status) ? 'bad-credentials' : 'rejected',
        };
      }

      let count: number | null = null;
      try {
        const parsed = JSON.parse(text) as { data?: unknown };
        if (Array.isArray(parsed.data)) count = parsed.data.length;
      } catch {
        /* the response was JSON-per-shape-we-do-not-need; auth already passed */
      }

      return {
        ok: true,
        provider: 'resend',
        detail:
          count === null
            ? 'API key is valid.'
            : `API key is valid. ${count} sending domain${count === 1 ? '' : 's'} configured.`,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

/* ------------------------------------------------------------------ */
/* Postmark                                                            */
/* ------------------------------------------------------------------ */

export const postmarkProvider: MailProvider = {
  id: 'postmark',
  requiresSecrets: true,

  async send(message: MailMessage, secrets): Promise<MailResult> {
    const apiToken = secrets.api_token;
    if (!apiToken) {
      return { ok: false, provider: 'postmark', detail: 'No API token stored.', failure: 'not-configured' };
    }
    if (!message.from) {
      return {
        ok: false,
        provider: 'postmark',
        detail: 'No from address is configured. Postmark will not send without one.',
        failure: 'not-configured',
      };
    }

    const payload: JsonRecord = {
      From: message.fromName ? `${message.fromName} <${message.from}>` : message.from,
      To: message.to,
      Subject: message.subject,
      MessageStream: 'outbound',
    };
    if (message.html) payload.HtmlBody = message.html;
    if (message.text) payload.TextBody = message.text;
    if (message.replyTo) payload.ReplyTo = message.replyTo;
    if (message.tags && Object.keys(message.tags).length) {
      payload.Metadata = message.tags;
    }
    if (message.attachments?.length) {
      payload.Attachments = message.attachments.map((file) => ({
        Name: file.filename,
        Content: file.content,
        ContentType: file.contentType,
      }));
    }

    const response = await postJson(
      'https://api.postmarkapp.com/email',
      {
        // Postmark's documented auth header is the literal word `Postmark`,
        // not a bearer token. Easy to get wrong and it fails as a 401.
        'X-Postmark-Server-Token': apiToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      payload,
    );

    if (!response.ok) {
      return {
        ok: false,
        provider: 'postmark',
        detail: `${describeFailure(response.json, response.text)} (HTTP ${response.status})`,
        failure: isAuthFailure(response.status) ? 'bad-credentials' : 'rejected',
      };
    }

    const id =
      isRecord(response.json) && typeof response.json.MessageID === 'string'
        ? response.json.MessageID
        : undefined;
    return { ok: true, provider: 'postmark', detail: 'accepted by Postmark', id };
  },

  async verify(secrets): Promise<MailResult> {
    if (!secrets.api_token) {
      return { ok: false, provider: 'postmark', detail: 'No API token stored.', failure: 'not-configured' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch('https://api.postmarkapp.com/deliverystats', {
        headers: { 'X-Postmark-Server-Token': secrets.api_token, Accept: 'application/json' },
        signal: controller.signal,
      });
      const text = await response.text();

      if (!response.ok) {
        return {
          ok: false,
          provider: 'postmark',
          detail: `${describeFailure(null, text)} (HTTP ${response.status})`,
          failure: isAuthFailure(response.status) ? 'bad-credentials' : 'rejected',
        };
      }

      return { ok: true, provider: 'postmark', detail: 'API token is valid.' };
    } finally {
      clearTimeout(timer);
    }
  },
};

/** Every provider the app can actually use today. */
export const MAIL_PROVIDERS: MailProvider[] = [consoleProvider, resendProvider, postmarkProvider];

export function mailProvider(id: string): MailProvider | null {
  return MAIL_PROVIDERS.find((provider) => provider.id === id) ?? null;
}