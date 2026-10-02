'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveEmailTemplate, toggleAutomation, type ActionResult } from '@/lib/actions/integrations';
import type { AutomationState, EmailTemplate } from '@/lib/mail/templates';
import { cn } from '@/lib/utils/cn';

/**
 * Email templates and the automations that fire them.
 *
 * ## Templates are edited as text, not as a rich-text document
 *
 * The bodies use `{{token}}` placeholders and are inserted into a minimal HTML
 * shell. A drag-and-drop editor would produce absolute URLs and inline styles
 * that no email client renders consistently, and it would make the merge tags
 * invisible — which is the one thing an operator editing a confirmation email
 * needs to see.
 *
 * ## Turning an automation off does not delete its template
 *
 * They are separate rows on purpose: silencing "order dispatched" during a
 * delivery glitch should not throw away the copy somebody spent an hour on.
 */

const inputClass =
  'w-full rounded-md border border-line bg-shell px-3 py-2 text-sm outline-none focus:border-line-strong';

function Submit({ label, pendingLabel, className }: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'rounded-md bg-ink px-3 py-2 text-sm text-porcelain transition-colors hover:bg-ink-soft disabled:opacity-60',
        className,
      )}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        state.ok ? 'border-line bg-success-soft text-success' : 'border-line bg-danger-soft text-danger',
      )}
    >
      {state.message}
    </p>
  );
}

const EVENT_LABELS: Record<string, string> = {
  'user.signup': 'Someone registers an account',
  'user.password_reset': 'Someone requests a password reset',
  'order.placed': 'An order is placed',
  'order.dispatched': 'An order is marked dispatched',
  'order.delivered': 'An order is marked delivered',
  'subscriber.subscribed': 'Someone joins the newsletter',
  'admin.broadcast': 'An operator sends a broadcast',
};

function TemplateEditor({ template }: { template: EmailTemplate }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(saveEmailTemplate, null);

  return (
    <details className="rounded-md border border-line bg-shell" open={!template.enabled}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        <span className="font-mono text-xs text-muted">{template.key}</span>
        <span className="ml-2">{template.subject}</span>
        {!template.enabled ? (
          <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-xs text-muted">off</span>
        ) : null}
      </summary>

      <form action={action} className="space-y-4 border-t border-line p-4">
        <input type="hidden" name="key" value={template.key} />

        <div>
          <label htmlFor={`subject-${template.key}`} className="block text-sm font-medium">
            Subject
          </label>
          <input
            id={`subject-${template.key}`}
            name="subject"
            required
            defaultValue={template.subject}
            className={cn(inputClass, 'mt-1.5')}
          />
        </div>

        <div>
          <label htmlFor={`html-${template.key}`} className="block text-sm font-medium">
            HTML body
          </label>
          <p className="mt-0.5 text-xs text-muted">
            Use <code className="rounded-xs bg-sand px-1">{'{{token}}'}</code> for values. Anything
            inserted is escaped unless it is a URL.
          </p>
          <textarea
            id={`html-${template.key}`}
            name="body_html"
            rows={8}
            defaultValue={template.bodyHtml}
            className={cn(inputClass, 'mt-1.5 font-mono text-xs')}
          />
        </div>

        <div>
          <label htmlFor={`text-${template.key}`} className="block text-sm font-medium">
            Plain-text body
          </label>
          <p className="mt-0.5 text-xs text-muted">
            Used when an email client cannot show HTML. Leaving it empty means those clients get an
            empty message.
          </p>
          <textarea
            id={`text-${template.key}`}
            name="body_text"
            rows={5}
            defaultValue={template.bodyText}
            className={cn(inputClass, 'mt-1.5 font-mono text-xs')}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={template.enabled}
            className="size-4 accent-moss"
          />
          Send this template
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Submit label="Save template" pendingLabel="Saving…" />
          <Feedback state={state} />
        </div>
      </form>
    </details>
  );
}

function AutomationToggle({ automation }: { automation: AutomationState }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(toggleAutomation, null);

  return (
    <form
      action={action}
      className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0"
    >
      <input type="hidden" name="event" value={automation.event} />

      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">
          {EVENT_LABELS[automation.event] ?? automation.event}
        </p>
        <p className="text-xs text-muted">
          <code className="rounded-xs bg-sand px-1">{automation.event}</code> →{' '}
          <code className="rounded-xs bg-sand px-1">{automation.templateKey}</code>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Feedback state={state} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={automation.enabled}
            className="size-4 accent-moss"
          />
          <span className="sr-only">Enable {automation.event}</span>
          <span aria-hidden>{automation.enabled ? 'On' : 'Off'}</span>
        </label>
        <Submit label="Apply" pendingLabel="…" />
      </div>
    </form>
  );
}

export function EmailAutomationPanel({
  templates,
  automations,
}: {
  templates: EmailTemplate[];
  automations: AutomationState[];
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Automations</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          What triggers an email. Turning one off suppresses the send but keeps the template.
        </p>
        <div className="mt-4 rounded-lg border border-line bg-shell px-4">
          {automations.map((automation) => (
            <AutomationToggle key={automation.event} automation={automation} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Templates</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          The copy each automation sends. Available tokens:{' '}
          <code className="rounded-xs bg-sand px-1">{'{{brand_name}}'}</code>,{' '}
          <code className="rounded-xs bg-sand px-1">{'{{first_name}}'}</code>,{' '}
          <code className="rounded-xs bg-sand px-1">{'{{order_number}}'}</code>,{' '}
          <code className="rounded-xs bg-sand px-1">{'{{order_total}}'}</code>,{' '}
          <code className="rounded-xs bg-sand px-1">{'{{confirm_url}}'}</code>,{' '}
          <code className="rounded-xs bg-sand px-1">{'{{reset_url}}'}</code>.
        </p>
        <div className="mt-4 space-y-3">
          {templates.map((template) => (
            <TemplateEditor key={template.key} template={template} />
          ))}
        </div>
      </section>
    </div>
  );
}