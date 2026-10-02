'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminSlide } from '@/lib/supabase/admin-content';
import {
  removeOnboardingSlide,
  reorderOnboarding,
  saveOnboardingSlide,
} from '@/lib/actions/admin';
import type { AdminActionResult } from '@/lib/actions/admin';

/**
 * Onboarding slide editor.
 *
 * Full CRUD over the first-visit sequence: create, edit, delete, reorder, and
 * toggle each slide, plus a position field for placement. The component holds
 * no copy of its own — every field comes from the slide record, so the wording
 * is the business's to change.
 */

const ICON_CHOICES = [
  'leaf', 'flask', 'sparkle', 'shield', 'droplet', 'truck', 'sun', 'moon', 'wind',
  'package', 'gift', 'info', 'check', 'leaf',
];

function Result({ result }: { result: AdminActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role="status"
      className={
        result.ok
          ? 'rounded-md border border-line bg-success-soft px-4 py-2.5 text-sm text-success'
          : 'rounded-md border border-line bg-danger-soft px-4 py-2.5 text-sm text-danger'
      }
    >
      {result.message}
    </p>
  );
}

const inputClass =
  'mt-1.5 w-full rounded-md border border-line bg-shell px-3 py-2 text-sm outline-none focus:border-line-strong';

export function SlideEditor({ slides }: { slides: AdminSlide[] }) {
  const [order, setOrder] = useState(slides.map((slide) => slide.id));
  const [orderState, orderAction, orderPending] = useActionState(reorderOnboarding, null);
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  const ordered = order
    .map((id) => slides.find((slide) => slide.id === id))
    .filter((slide): slide is AdminSlide => slide !== undefined);

  const move = (index: number, delta: number) => {
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      if (item === undefined) return current;
      next.splice(target, 0, item);
      return next;
    });
  };

  const dirty = order.join() !== slides.map((slide) => slide.id).join();
  const liveCount = slides.filter((slide) => slide.enabled).length;

  return (
    <div className="space-y-6">
      <form action={orderAction} className="space-y-3">
        <input type="hidden" name="order" value={order.join(',')} />

        {ordered.length === 0 ? (
          <p className="rounded-lg border border-line bg-shell p-6 text-sm text-muted">
            No slides yet. With none, the storefront shows no introduction at all.
          </p>
        ) : (
          <ol className="space-y-3">
            {ordered.map((slide, index) => (
              <li key={slide.id}>
                <SlideCard
                  slide={slide}
                  index={index}
                  total={ordered.length}
                  onMove={move}
                  onChanged={() => router.refresh()}
                />
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button
            type="submit"
            disabled={!dirty || orderPending}
            className="rounded-md bg-ink px-4 py-2 text-sm text-porcelain disabled:opacity-40"
          >
            {orderPending ? 'Saving…' : 'Save order'}
          </button>
          <button
            type="button"
            onClick={() => setAdding((current) => !current)}
            className="rounded-md border border-line px-4 py-2 text-sm transition-colors hover:border-line-strong"
          >
            {adding ? 'Cancel' : 'Add slide'}
          </button>
          <Result result={orderState} />
        </div>
      </form>

      {adding && <NewSlideForm onDone={() => { setAdding(false); router.refresh(); }} />}

      <p className="text-sm text-muted">
        {liveCount} of {slides.length} {slides.length === 1 ? 'slide is' : 'slides are'} live. With
        none live, visitors see no introduction.
      </p>
    </div>
  );
}

function SlideCard({
  slide,
  index,
  total,
  onMove,
  onChanged,
}: {
  slide: AdminSlide;
  index: number;
  total: number;
  onMove: (index: number, delta: number) => void;
  onChanged: () => void;
}) {
  const [state, action, pending] = useActionState(saveOnboardingSlide, null);
  const [removeState, removeAction, removing] = useActionState(removeOnboardingSlide, null);
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-line bg-shell">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="w-6 shrink-0 text-sm tabular-nums text-muted">{index + 1}</span>

        <button type="button" onClick={() => setOpen((c) => !c)} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <span className="block truncate font-medium">{slide.title}</span>
          <span className="block text-xs text-muted">
            {slide.eyebrow ?? 'No eyebrow'}
            {slide.icon ? ` · ${slide.icon}` : ''}
            {slide.image ? ' · image' : ''}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label={`Move ${slide.title} up`}
            className="rounded border border-line px-2 py-1 text-sm disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            aria-label={`Move ${slide.title} down`}
            className="rounded border border-line px-2 py-1 text-sm disabled:opacity-30"
          >
            ↓
          </button>
          <span
            className={
              slide.enabled
                ? 'rounded-xs bg-success-soft px-2 py-1 text-xs text-success'
                : 'rounded-xs bg-sand px-2 py-1 text-xs text-muted'
            }
          >
            {slide.enabled ? 'Live' : 'Hidden'}
          </span>
        </div>
      </div>

      {open && (
        <form action={action} className="space-y-4 border-t border-line p-4">
          <input type="hidden" name="id" value={slide.id} />
          <input type="hidden" name="enabled" value={slide.enabled ? 'true' : 'false'} />
          <input type="hidden" name="image_id" value={slide.imageId ?? ''} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`eyebrow-${slide.id}`} className="block text-sm font-medium">Eyebrow</label>
              <input id={`eyebrow-${slide.id}`} name="eyebrow" maxLength={80} defaultValue={slide.eyebrow ?? ''} className={inputClass} />
            </div>
            <div>
              <label htmlFor={`icon-${slide.id}`} className="block text-sm font-medium">Icon</label>
              <select id={`icon-${slide.id}`} name="icon" defaultValue={slide.icon ?? ''} className={inputClass}>
                <option value="">No icon</option>
                {[...new Set(ICON_CHOICES)].map((icon) => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor={`title-${slide.id}`} className="block text-sm font-medium">Title</label>
            <input id={`title-${slide.id}`} name="title" required maxLength={160} defaultValue={slide.title} className={inputClass} />
          </div>

          <div>
            <label htmlFor={`body-${slide.id}`} className="block text-sm font-medium">Body</label>
            <textarea id={`body-${slide.id}`} name="body" required rows={4} maxLength={2000} defaultValue={slide.body} className={inputClass} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={`cta-label-${slide.id}`} className="block text-sm font-medium">CTA label</label>
              <input id={`cta-label-${slide.id}`} name="cta_label" maxLength={60} defaultValue={slide.ctaLabel ?? ''} className={inputClass} />
            </div>
            <div>
              <label htmlFor={`cta-href-${slide.id}`} className="block text-sm font-medium">CTA destination</label>
              <input id={`cta-href-${slide.id}`} name="cta_href" maxLength={300} defaultValue={slide.ctaHref ?? ''} className={inputClass} />
            </div>
            <div>
              <label htmlFor={`position-${slide.id}`} className="block text-sm font-medium">Position</label>
              <input id={`position-${slide.id}`} name="position" type="number" min="0" defaultValue={slide.position} className={inputClass} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className="rounded-md bg-ink px-4 py-2 text-sm text-porcelain disabled:opacity-60">
              {pending ? 'Saving…' : 'Save slide'}
            </button>
            <Result result={state} />
          </div>
        </form>
      )}

      <form action={removeAction} className="flex items-center gap-3 border-t border-line px-4 py-3">
        <input type="hidden" name="id" value={slide.id} />
        <button
          type="submit"
          disabled={removing}
          className="rounded-md border border-danger px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
        >
          {removing ? 'Deleting…' : 'Delete'}
        </button>
        <Result result={removeState} />
        <button type="button" onClick={onChanged} className="text-sm text-muted underline underline-offset-4">
          Refresh
        </button>
      </form>
    </div>
  );
}

function NewSlideForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(saveOnboardingSlide, null);

  return (
    <form action={action} className="space-y-4 rounded-lg border border-line bg-shell p-4">
      <h2 className="text-sm font-semibold">New slide</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-eyebrow" className="block text-sm font-medium">Eyebrow</label>
          <input id="new-eyebrow" name="eyebrow" maxLength={80} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-icon" className="block text-sm font-medium">Icon</label>
          <select id="new-icon" name="icon" defaultValue="leaf" className={inputClass}>
            {[...new Set(ICON_CHOICES)].map((icon) => (
              <option key={icon} value={icon}>{icon}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="new-title" className="block text-sm font-medium">Title</label>
        <input id="new-title" name="title" required maxLength={160} className={inputClass} />
      </div>

      <div>
        <label htmlFor="new-body" className="block text-sm font-medium">Body</label>
        <textarea id="new-body" name="body" required rows={4} maxLength={2000} className={inputClass} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="new-cta-label" className="block text-sm font-medium">CTA label</label>
          <input id="new-cta-label" name="cta_label" maxLength={60} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-cta-href" className="block text-sm font-medium">CTA destination</label>
          <input id="new-cta-href" name="cta_href" maxLength={300} className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-position" className="block text-sm font-medium">Position</label>
          <input id="new-position" name="position" type="number" min="0" defaultValue={99} className={inputClass} />
        </div>
      </div>

      <input type="hidden" name="enabled" value="true" />

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-md bg-ink px-4 py-2 text-sm text-porcelain disabled:opacity-60">
          {pending ? 'Creating…' : 'Create slide'}
        </button>
        <button type="button" onClick={onDone} className="text-sm text-muted underline underline-offset-4">
          Cancel
        </button>
        <Result result={state} />
      </div>
    </form>
  );
}
