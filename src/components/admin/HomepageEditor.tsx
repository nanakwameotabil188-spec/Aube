'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminSection } from '@/lib/supabase/admin-content';
import { reorderHomepageSections, saveHomeSection, toggleSection, addHomeSection } from '@/lib/actions/admin';
import type { AdminActionResult } from '@/lib/actions/admin';
import { CategoryShowcaseFields } from './CategoryShowcaseFields';

/**
 * Homepage composition editor.
 *
 * Ordering uses explicit up/down controls plus a single "Save order" submit,
 * rather than drag-and-drop. That is a deliberate trade: up/down is keyboard
 * operable, works on touch without gesture conflicts, and produces one
 * ordered list to persist, whereas a drag library would be more code and
 * would still need a keyboard equivalent to be accessible. The order is written
 * to `home_sections.position` and the storefront renders by it.
 *
 * This component only presents data and calls actions. The section records
 * come from the server, so moving to Supabase changed nothing here.
 */

const KIND_LABELS: Record<string, string> = {
  hero: 'Hero',
  'product-rail': 'Product rail',
  'collection-feature': 'Collection feature',
  'category-tiles': 'Category tiles',
  'category-showcase': 'Categories with products',
  'concern-tiles': 'Skin concern tiles',
  'ingredient-strip': 'Ingredient strip',
  'editorial-split': 'Editorial split',
  'value-strip': 'Values strip',
  testimonials: 'Testimonials',
  journal: 'Journal',
  faq: 'FAQ',
  routine: 'Routine steps',
  'promo-banner': 'Promo banner',
  newsletter: 'Newsletter',
};

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

export function HomepageEditor({
  sections,
  categories = [],
}: {
  sections: AdminSection[];
  /** Live category records, with visible product counts, for the showcase picker. */
  categories?: { id: string; name: string; productCount: number }[];
}) {
  const [order, setOrder] = useState(sections.map((section) => section.id));
  const [orderState, orderAction, orderPending] = useActionState(
    reorderHomepageSections,
    null,
  );
  const router = useRouter();

  const ordered = order
    .map((id) => sections.find((section) => section.id === id))
    .filter((section): section is AdminSection => section !== undefined);

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

  const dirty = order.join() !== sections.map((section) => section.id).join();

  return (
    <div className="space-y-6">
      <form action={orderAction} className="space-y-3">
        <input type="hidden" name="order" value={order.join(',')} />

        <ol className="space-y-3">
          {ordered.map((section, index) => (
            <li key={section.id}>
              <SectionRow
                section={section}
                index={index}
                total={ordered.length}
                categories={categories}
                onMove={move}
                onChanged={() => router.refresh()}
              />
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button
            type="submit"
            disabled={!dirty || orderPending}
            className="rounded-md bg-ink px-4 py-2 text-sm text-porcelain transition-colors hover:bg-ink-soft disabled:opacity-40"
          >
            {orderPending ? 'Saving…' : 'Save order'}
          </button>
          {dirty ? (
            <button
              type="button"
              onClick={() => setOrder(sections.map((section) => section.id))}
              className="text-sm text-muted underline underline-offset-4 hover:text-ink"
            >
              Discard changes
            </button>
          ) : null}
          <Result result={orderState} />
        </div>
      </form>

      <AddSectionForm />
    </div>
  );
}

/**
 * Adds a section from a template.
 *
 * New sections arrive switched off. A blank section renders as nothing, and
 * enabling one the moment it is created would put an empty band on a live
 * homepage with no obvious way back — the admin should choose to switch it on.
 */
function AddSectionForm() {
  return (
    <form action={addHomeSection} className="flex flex-wrap items-end gap-3 border-t border-line pt-6">
      <div>
        <label htmlFor="new-section" className="block text-sm font-medium">
          Add a section
        </label>
        <select
          id="new-section"
          name="kind"
          defaultValue="category-showcase"
          className="mt-1.5 rounded-md border border-line bg-shell px-3 py-2 text-sm"
        >
          <option value="category-showcase">Categories with products</option>
        </select>
      </div>
      <button
        type="submit"
        className="rounded-md border border-line px-4 py-2 text-sm hover:bg-sand"
      >
        Add section
      </button>
      <p className="text-xs text-muted">New sections start switched off.</p>
    </form>
  );
}

function SectionRow({
  section,
  index,
  total,
  categories,
  onMove,
  onChanged,
}: {
  section: AdminSection;
  index: number;
  total: number;
  categories: { id: string; name: string; productCount: number }[];
  onMove: (index: number, delta: number) => void;
  onChanged: () => void;
}) {
  const [state, action, pending] = useActionState(saveHomeSection, null);
  const [, toggleAction, toggling] = useActionState(toggleSection, null);
  const [open, setOpen] = useState(false);

  const title = section.title || KIND_LABELS[section.kind] || section.kind;

  return (
    <div className="rounded-lg border border-line bg-shell">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="w-6 shrink-0 text-sm tabular-nums text-muted">{index + 1}</span>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate font-medium">{title}</span>
          <span className="block text-xs text-muted">
            {KIND_LABELS[section.kind] ?? section.kind}
            {section.eyebrow ? ` · ${section.eyebrow}` : ''}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            aria-label={`Move ${title} up`}
            className="rounded border border-line px-2 py-1 text-sm disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            aria-label={`Move ${title} down`}
            className="rounded border border-line px-2 py-1 text-sm disabled:opacity-30"
          >
            ↓
          </button>

          <form action={toggleAction} className="inline">
            <input type="hidden" name="id" value={section.id} />
            <input type="hidden" name="enabled" value={section.enabled ? 'false' : 'true'} />
            <button
              type="submit"
              disabled={toggling}
              className={
                section.enabled
                  ? 'rounded-xs bg-success-soft px-2 py-1 text-xs text-success'
                  : 'rounded-xs bg-sand px-2 py-1 text-xs text-muted'
              }
            >
              {section.enabled ? 'Live' : 'Hidden'}
            </button>
          </form>
        </div>
      </div>

      {open && (
        <form action={action} className="space-y-4 border-t border-line p-4">
          <input type="hidden" name="id" value={section.id} />
          <input type="hidden" name="enabled" value={section.enabled ? 'true' : 'false'} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Eyebrow" name="eyebrow" defaultValue={section.eyebrow ?? ''} maxLength={80} />
            <Field label="Title" name="title" defaultValue={section.title ?? ''} maxLength={200} />
          </div>

          <Field
            label="Subtitle"
            name="subtitle"
            defaultValue={section.subtitle ?? ''}
            maxLength={400}
            textarea
          />

          <Field label="Body" name="body" defaultValue={section.body ?? ''} maxLength={4000} textarea rows={5} />

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="CTA label" name="cta_label" defaultValue={section.ctaLabel ?? ''} maxLength={60} />
            <Field label="CTA destination" name="cta_href" defaultValue={section.ctaHref ?? ''} maxLength={300} />
            <div>
              <label htmlFor={`style-${section.id}`} className="block text-sm font-medium">
                CTA style
              </label>
              <select
                id={`style-${section.id}`}
                name="cta_style"
                defaultValue={section.ctaStyle ?? ''}
                className="mt-1.5 w-full rounded-md border border-line bg-shell px-3 py-2 text-sm"
              >
                <option value="">None</option>
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="text">Text</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-ink px-4 py-2 text-sm text-porcelain disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Save section'}
            </button>
            <button
              type="button"
              onClick={onChanged}
              className="text-sm text-muted underline underline-offset-4"
            >
              Refresh
            </button>
            <Result result={state} />
          </div>
        </form>
      )}

      {/*
        The category controls live outside the shared copy form because they edit
        the payload rather than the columns, and they are a separate action. A
        reader who edits the heading and the category list in one form would get
        one of the two silently discarded.
      */}
      {open && section.kind === 'category-showcase' ? (
        <div className="border-t border-line p-4">
          <CategoryShowcaseFields section={section} categories={categories} />
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  maxLength,
  textarea,
  rows,
}: {
  label: string;
  name: string;
  defaultValue: string;
  maxLength: number;
  textarea?: boolean;
  rows?: number;
}) {
  const id = `field-${name}`;
  const className =
    'mt-1.5 w-full rounded-md border border-line bg-shell px-3 py-2 text-sm outline-none focus:border-line-strong';

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={id}
          name={name}
          rows={rows ?? 3}
          maxLength={maxLength}
          defaultValue={defaultValue}
          className={className}
        />
      ) : (
        <input
          id={id}
          name={name}
          maxLength={maxLength}
          defaultValue={defaultValue}
          className={className}
        />
      )}
    </div>
  );
}
