'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/store/toast-context';
import { subscribeToNewsletter } from '@/lib/actions';

/**
 * Newsletter capture.
 *
 * Submits to the server action, which stores the address. One reserved address
 * routes to the admin login instead of subscribing; that rule is evaluated on
 * the server, so all this component receives is a result code.
 *
 * The honeypot stays as the first check so a bot never reaches the network.
 */

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Which surface the form sits on.
 *
 * The homepage renders this inside the dark `bg-ink` newsletter section, while
 * the FAQ and Journal callouts sit on light page backgrounds. Text colour
 * inherits from the section, so a single set of styles cannot serve both: the
 * dark section pushed white text onto the white `bg-shell` input, which made
 * the typed value and the caret invisible. Every colour is set explicitly per
 * tone rather than left to inheritance.
 */
type Tone = 'light' | 'dark';

export function NewsletterForm({
  incentive,
  consentCopy,
  className,
  compact = false,
  source = 'newsletter',
  tone = 'light',
  onSubscribed,
}: {
  incentive: string;
  consentCopy: string;
  className?: string;
  compact?: boolean;
  /** Recorded against the row so the admin list can show where a signup came from. */
  source?: string;
  tone?: Tone;
  onSubscribed?: () => void;
}) {
  const dark = tone === 'dark';

  const inputClass = dark
    ? 'h-11 w-full rounded-xs border border-line/40 bg-ink text-shell placeholder:text-muted-light caret-shell focus:border-shell focus:outline-none'
    : 'h-11 w-full rounded-xs border border-line bg-shell text-ink placeholder:text-muted-light focus:border-ink focus:outline-none';

  const submitClass = dark
    ? 'inline-flex h-11 items-center justify-center gap-2 rounded-xs bg-shell px-6 text-sm font-medium text-ink transition-colors duration-300 hover:bg-sand disabled:opacity-50'
    : 'inline-flex h-11 items-center justify-center gap-2 rounded-xs bg-ink px-6 text-sm font-medium text-shell transition-colors duration-300 hover:bg-moss-deep disabled:opacity-50';

  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const emailId = useId();
  const consentId = useId();
  const honeypotId = useId();
  const { notify } = useToast();
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '');

    // Honeypot: real users never see this field, so a value means a bot.
    if (String(data.get('company') ?? '').length > 0) return;

    setStatus('submitting');
    const result = await subscribeToNewsletter(email, source);

    if (result === 'admin') {
      // Routing only. The login page still demands a password for a real
      // admin_users row, so arriving here grants nothing on its own.
      router.push('/admin/login');
      return;
    }

    if (result === 'invalid') {
      setStatus('error');
      setMessage('That does not look like an email address.');
      return;
    }

    if (result === 'unavailable') {
      setStatus('error');
      setMessage('We could not save that just now. Please try again shortly.');
      return;
    }

    setStatus('success');
    setMessage('You are on the list. We will be in touch.');
    notify('You are on the list.', { tone: 'success' });
    form.reset();
    onSubscribed?.();
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        className={cn(
          'flex items-start gap-2.5 rounded-xs border px-3.5 py-3',
          dark
            ? 'border-shell/25 bg-shell/10 text-shell'
            : 'border-success/25 bg-success-soft text-success',
          className,
        )}
      >
        <Icon name="check" size={15} className={cn('mt-0.5 shrink-0', dark ? 'text-shell' : 'text-success')} aria-hidden />
        <p className="text-sm leading-relaxed">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={cn('flex flex-col gap-3', className)} noValidate>
      {!compact && (
        <p className={cn('text-sm leading-relaxed', dark ? 'text-muted-light' : 'text-muted')}>
          {incentive}
        </p>
      )}

      <div>
        <label htmlFor={emailId} className="sr-only">
          Email address
        </label>
        <div className="relative">
          <input
            id={emailId}
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={cn('pl-3.5 pr-3 text-base', inputClass)}
          />
        </div>
      </div>

      {/* Honeypot — hidden from users, irresistible to bots. */}
      <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
        <label htmlFor={honeypotId}>Company</label>
        <input id={honeypotId} type="text" name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex items-start gap-2.5">
        <input
          id={consentId}
          type="checkbox"
          name="consent"
          required
          data-tone={tone}
          className="consent-tick mt-0.5 size-4 shrink-0 rounded-xs border border-line-strong transition-colors checked:border-ink"
        />
        <label
          htmlFor={consentId}
          className={cn(
            'cursor-pointer text-xs leading-relaxed',
            dark ? 'text-muted-light' : 'text-muted',
          )}
        >
          {consentCopy}
        </label>
      </div>

      <button
        type="submit"
        disabled={status === 'submitting'}
        className={cn('disabled:opacity-50', submitClass)}
      >
        {status === 'submitting' ? (
          <>
            <span className="skeleton size-3.5 rounded-full" />
            Subscribing
          </>
        ) : (
          'Subscribe'
        )}
      </button>

      {status === 'error' && (
        <p role="alert" className="text-xs text-danger">
          {message || 'Something went wrong. Please try again.'}
        </p>
      )}
    </form>
  );
}
