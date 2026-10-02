'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { sendBroadcast, sendTestEmail, type MessageResult } from '@/lib/actions/messaging';
import { cn } from '@/lib/utils/cn';

/**
 * Compose and send.
 *
 * ## Preview before send, and a stated cap
 *
 * Two guards on the one action in this app that can email thousands of people at
 * once. Preview renders a single message through the real provider path without
 * touching the list, so an operator can see the artwork and merge tags as the
 * recipient will. The cap is stated in the result rather than silently
 * truncating, because a half-sent campaign is worse than a refused one.
 */

const inputClass =
  'w-full rounded-md border border-line bg-shell px-3 py-2 text-sm outline-none focus:border-line-strong';

function Submit({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'rounded-md bg-ink px-4 py-2 text-sm text-porcelain transition-colors hover:bg-ink-soft disabled:opacity-60',
        className,
      )}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Feedback({ state }: { state: MessageResult | null }) {
  if (!state) return null;
  return (
    <div
      role="status"
      className={cn(
        'rounded-md border px-4 py-3 text-sm',
        state.ok ? 'border-line bg-success-soft text-success' : 'border-line bg-danger-soft text-danger',
      )}
    >
      <p>{state.message}</p>
      {state.detail ? (
        <p className="mt-1 text-xs opacity-80">
          attempted {state.detail.attempted} · sent {state.detail.sent} · failed{' '}
          {state.detail.failed}
          {state.detail.notified > 0 ? ` · ${state.detail.notified} in-app` : ''}
        </p>
      ) : null}
    </div>
  );
}

export function ComposePanel({
  media,
  counts,
}: {
  media: { id: string; url: string; alt: string }[];
  counts: { customers: number; subscribers: number };
}) {
  const [state, action] = useActionState<MessageResult | null, FormData>(sendBroadcast, null);
  const [imageId, setImageId] = useState<string>('');
  /*
   * One form, two submit buttons, and the action has to know which was pressed.
   *
   * `submitter.value` is the obvious mechanism and it is unreliable here: React
   * controls the submit button, and the value has to be in the FormData before
   * React builds it. A hidden field driven by state is the version that behaves
   * the same in every browser.
   */
  const [previewOnly, setPreviewOnly] = useState(false);

  const chosen = media.find((item) => item.id === imageId);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="audience" className="block text-sm font-medium">
            Send to
          </label>
          <select
            id="audience"
            name="audience"
            className={cn(inputClass, 'mt-1.5')}
            defaultValue="subscribers"
          >
            <option value="subscribers">
              Newsletter subscribers ({counts.subscribers})
            </option>
            <option value="customers">Account holders ({counts.customers})</option>
            <option value="both">
              Both lists ({counts.subscribers + counts.customers})
            </option>
          </select>
          <p className="mt-1 text-xs text-muted">
            Subscribers get an unsubscribe link. Account holders do not — they made an account, which
            is not the same as subscribing to marketing.
          </p>
        </div>

        <div>
          <label htmlFor="image_id" className="block text-sm font-medium">
            Image
          </label>
          <select
            id="image_id"
            name="image_id"
            className={cn(inputClass, 'mt-1.5')}
            value={imageId}
            onChange={(event) => setImageId(event.target.value)}
          >
            <option value="">No image</option>
            {media.map((item) => (
              <option key={item.id} value={item.id}>
                {item.alt || item.id}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Embedded at the top of the message and attached as a file.
          </p>
        </div>
      </div>

      {chosen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={chosen.url}
          alt=""
          className="max-h-48 w-fit rounded-md border border-line object-contain"
        />
      ) : null}

      <div>
        <label htmlFor="subject" className="block text-sm font-medium">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          required
          maxLength={200}
          className={cn(inputClass, 'mt-1.5')}
          placeholder="What this is about"
        />
      </div>

      <div>
        <label htmlFor="body" className="block text-sm font-medium">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={10}
          className={cn(inputClass, 'mt-1.5')}
          placeholder="Write the message. Blank lines are kept."
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="also_notify"
          className="mt-0.5 size-4 accent-moss"
        />
        <span>
          Also create an in-app notification for account holders
          <span className="block text-xs text-muted">
            Shows in their account bell. The image and message are reused.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <input type="hidden" name="preview_only" value={previewOnly ? 'true' : 'false'} />

        <button
          type="submit"
          onClick={() => setPreviewOnly(true)}
          className="rounded-md border border-line px-4 py-2 text-sm hover:bg-sand"
        >
          Preview only
        </button>

        <Submit
          label="Send to the list"
          pendingLabel="Sending…"
          className="bg-danger hover:bg-danger-soft"
        />
      </div>

      <Feedback state={state} />
    </form>
  );
}

export function TestSendPanel() {
  const [state, action] = useActionState<MessageResult | null, FormData>(sendTestEmail, null);

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted">Send one message to check the provider is really delivering.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="test_to" className="block text-sm font-medium">
            Send to
          </label>
          <input
            id="test_to"
            name="to"
            type="email"
            required
            className={cn(inputClass, 'mt-1.5')}
            placeholder="you@example.com"
          />
        </div>
        <div className="min-w-[16rem] flex-1">
          <label htmlFor="test_subject" className="block text-sm font-medium">
            Subject
          </label>
          <input
            id="test_subject"
            name="subject"
            className={cn(inputClass, 'mt-1.5')}
            placeholder="Test email"
          />
        </div>
        <Submit label="Send test" pendingLabel="Sending…" />
      </div>
      <Feedback state={state} />
    </form>
  );
}