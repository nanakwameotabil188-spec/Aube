/**
 * Mail transport types.
 *
 * Deliberately provider-shaped rather than provider-specific. Every provider
 * implements `MailProvider`, so adding one means writing one adapter and adding
 * a case to the switch in `send.ts` — not touching the automation engine, the
 * templates, or anything that calls `sendMail`.
 */

export interface MailAttachment {
  /** File name as it will appear in the message. */
  filename: string;
  /** Base64-encoded bytes. */
  content: string;
  /** MIME type, e.g. `image/png`. */
  contentType: string;
  /** Set for inline images referenced by `cid:` in the HTML. */
  contentId?: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  /** Overrides the configured sender. Must be an address the provider allows. */
  from?: string;
  fromName?: string;
  replyTo?: string;
  attachments?: MailAttachment[];
  /** Provider metadata — campaign ids, template tags. */
  tags?: Record<string, string>;
}

export type MailFailure =
  /** No provider chosen, or the integration is switched off. */
  | 'not-configured'
  /** The provider is listed but not implemented in this app. */
  | 'provider-unsupported'
  /** The provider was called and refused. */
  | 'rejected'
  /** Credentials are present but the provider rejected them. */
  | 'bad-credentials';

export interface MailResult {
  ok: boolean;
  provider: string;
  /** Human-readable outcome, safe to log and to show in the admin. */
  detail: string;
  failure?: MailFailure;
  /** Provider-side message id, when there is one. */
  id?: string;
}

export interface MailProvider {
  readonly id: string;
  /**
   * Whether this provider needs credentials to function.
   *
   * `console` does not, which is what lets the whole automation engine be
   * exercised — and tested — before anybody signs up for a provider.
   */
  readonly requiresSecrets: boolean;
  /** Sends one message. Must never throw; failure is returned. */
  send(message: MailMessage, secrets: Record<string, string>): Promise<MailResult>;
  /**
   * Verifies credentials without sending anything to a real person.
   *
   * Used by the admin's "Test connection" button. It must not send mail to an
   * arbitrary address as a probe.
   */
  verify(secrets: Record<string, string>): Promise<MailResult>;
}

/** A provider that accepts nothing, used for `none` and unimplemented entries. */
export function unsupported(
  id: string,
  reason: string,
): MailProvider & { requiresSecrets: boolean } {
  return {
    id,
    requiresSecrets: false,
    async send() {
      return { ok: false, provider: id, detail: reason, failure: 'provider-unsupported' };
    },
    async verify() {
      return { ok: false, provider: id, detail: reason, failure: 'provider-unsupported' };
    },
  };
}

/** Pulls a usable address out of a `Name <addr@example.com>` string. */
export function addressOnly(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /<([^>]+)>/.exec(value);
  return (match?.[1] ?? value).trim();
}