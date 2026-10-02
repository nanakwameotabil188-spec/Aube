'use client';

import { cn } from '@/lib/utils/cn';

/**
 * Product image picker.
 *
 * Controlled rather than a set of uncontrolled checkboxes. The reason is
 * structural: the uploader beside this grid is its own form, and it cannot live
 * inside the product form without nesting one form in another — invalid HTML
 * that browsers resolve by silently closing the outer form, and that drags the
 * uploader's own `required` field into the product's submission. Keeping the
 * selection in React state and posting it through hidden inputs lets the two
 * forms be genuine siblings.
 *
 * The trade is that a checkbox here is no longer a form control, so there is
 * nothing to submit if the component unmounts mid-edit. It cannot: the state
 * lives in the form that owns it, and the form is what saves.
 *
 * The primary image is a radio rather than a checkbox: it is what every card,
 * search result and cart line shows, and two primaries is a rendering bug
 * rather than a state the storefront can resolve.
 */
export interface ImageSelection {
  /** Ids to attach, in order. */
  ids: string[];
  /** Which of those is the primary. */
  primaryId: string;
}

export function ImagePicker({
  media,
  selection,
  onChange,
}: {
  media: { id: string; url: string; alt: string }[];
  selection: ImageSelection;
  onChange: (next: ImageSelection) => void;
}) {
  if (media.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
        No images in the library yet. Use “Upload a product image” above to add one.
      </p>
    );
  }

  const selected = new Set(selection.ids);
  const isTicked = (id: string) => selected.has(id);

  const toggle = (id: string) => {
    if (selected.has(id)) {
      const ids = selection.ids.filter((entry) => entry !== id);
      onChange({
        ids,
        // Losing the primary because its image was unticked would leave the
        // product with no main picture and no obvious way back.
        primaryId: selection.primaryId === id ? ids[0] ?? '' : selection.primaryId,
      });
      return;
    }
    onChange({
      ids: [...selection.ids, id],
      // The first image picked becomes the primary automatically; nobody should
      // have to work out that a product with no primary has no card image.
      primaryId: selection.primaryId || id,
    });
  };

  const setPrimary = (id: string) => {
    if (!selected.has(id)) {
      // Choosing a primary that is not attached would post an id the product
      // does not reference, which the save would reject or silently ignore.
      onChange({ ids: [...selection.ids, id], primaryId: id });
      return;
    }
    onChange({ ...selection, primaryId: id });
  };

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {media.map((image) => {
        const ticked = isTicked(image.id);
        const primary = selection.primaryId === image.id;

        return (
          <li
            key={image.id}
            className={cn(
              'rounded-md border bg-shell p-2 transition',
              primary ? 'border-ink ring-1 ring-ink' : ticked ? 'border-line-strong' : 'border-line',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={image.alt}
              loading="lazy"
              className="aspect-square w-full rounded object-cover"
            />

            <div className="mt-2 space-y-1">
              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={ticked}
                  onChange={() => toggle(image.id)}
                  className="mt-0.5 size-4 shrink-0 accent-moss"
                />
                <span>Use on this product</span>
              </label>

              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="radio"
                  name="picker-primary"
                  checked={primary}
                  onChange={() => setPrimary(image.id)}
                  className="mt-0.5 size-4 shrink-0 accent-moss"
                />
                <span>
                  Primary
                  {primary ? <span className="ml-1 text-muted">(shown on cards)</span> : null}
                </span>
              </label>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Carries the selection into the product form.
 *
 * One hidden input per id because the save reads `getAll('image_ids')`; a single
 * comma-joined value would need a second parse step for no benefit.
 */
export function ImageSelectionInputs({ selection }: { selection: ImageSelection }) {
  return (
    <>
      {selection.ids.map((id) => (
        <input key={id} type="hidden" name="image_ids" value={id} />
      ))}
      <input type="hidden" name="primary_image_id" value={selection.primaryId} />
    </>
  );
}
