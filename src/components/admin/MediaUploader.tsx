'use client';

import { useActionState, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { uploadMediaImage, type MediaActionResult } from '@/lib/actions/admin';

/**
 * Media uploader.
 *
 * Dropping or choosing a file uploads it to Supabase Storage and returns a URL
 * the rest of the panel can reference. The returned URL is surfaced in a
 * read-only field and copied to the clipboard, because the media library is
 * also usable without wiring an image picker into every other form.
 *
 * `compact` drops the folder picker and the result URL block. It is used where
 * the folder is already known and the caller only needs the image to land in
 * the library — the product editor picks from that library on the next render.
 *
 * ## Why the form element is portalled
 *
 * This component is used *inside* the product and brand forms, so it cannot
 * render its own `<form>` there. Nested forms are invalid HTML, and the parser
 * resolves them by discarding the inner start tag — which means this uploader's
 * submit button would post the enclosing product form, silently uploading
 * nothing while appearing to work, and dragging this component's own `required`
 * alt-text field into the product's validation.
 *
 * The fix is the HTML form-owner override rather than a layout compromise. The
 * real `<form>` is rendered into `document.body` through a portal, and every
 * control here points at it with `form={formId}`. Ownership is by id, not by
 * ancestry, so these fields belong to the upload form even though they are
 * visually nested inside the product form. That keeps the uploader where the
 * operator expects it — directly above the gallery it is uploading into —
 * instead of moving it to a separate page.
 */

const FOLDERS = [
  { value: 'products', label: 'Products' },
  { value: 'categories', label: 'Categories' },
  { value: 'homepage', label: 'Homepage' },
  { value: 'onboarding', label: 'Intro' },
  { value: 'branding', label: 'Branding' },
  { value: 'reviews', label: 'Reviews' },
];

export function MediaUploader({
  defaultFolder = 'products',
  compact = false,
  onUploaded,
}: {
  defaultFolder?: string;
  compact?: boolean;
  /**
   * Fired with the new image id after a successful upload.
   *
   * In compact mode the caller uses this to attach the image to whatever it is
   * editing, which is the whole point of the shortcut — the alternative was
   * uploading, reloading, hunting for the new thumbnail, and ticking it.
   */
  onUploaded?: (id: string) => void;
}) {
  const [state, action, pending] = useActionState<MediaActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await uploadMediaImage(prev, formData);
      if (result.ok && result.id) onUploaded?.(result.id);
      return result;
    },
    null,
  );
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // `useId` so two uploaders on one page (the branding form has three) cannot
  // claim the same form owner.
  const formId = `media-upload-${useId()}`;
  const altId = `${formId}-alt`;
  const fileId = `${formId}-file`;

  /**
   * Whether the DOM exists yet.
   *
   * The portalled form goes to `document.body`, so it cannot be rendered during
   * the server pass. `useSyncExternalStore` is the supported way to branch on
   * that without an effect that calls setState: the client snapshot is a
   * constant, so this never re-renders on its own, and the server snapshot
   * keeps hydration from disagreeing about whether a portal exists.
   */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  /**
   * The library grid is rendered by the server, so a newly uploaded image does
   * not exist in the DOM until the page re-renders. Refreshing is what makes
   * the image selectable in the same visit instead of the next one.
   */
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const preview = state?.ok && state.url ? state.url : null;

  return (
    <div className="rounded-lg border border-line bg-shell p-4">
      {/* The submit target lives at the body root; see the note above. */}
      {mounted
        ? createPortal(
            <form id={formId} action={action} />,
            document.body,
          )
        : null}

      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {compact ? (
            <input type="hidden" name="folder" value={defaultFolder} form={formId} />
          ) : (
            <div>
              <label htmlFor={`${formId}-folder`} className="block text-xs font-medium">
                Folder
              </label>
              <select
                id={`${formId}-folder`}
                name="folder"
                form={formId}
                defaultValue={defaultFolder}
                className="mt-1 w-full rounded-md border border-line bg-shell px-3 py-2 text-sm"
              >
                {FOLDERS.map((folder) => (
                  <option key={folder.value} value={folder.value}>
                    {folder.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor={altId} className="block text-xs font-medium">
              Alt text
            </label>
            <input
              id={altId}
              name="alt"
              form={formId}
              required
              placeholder="Describe what the image shows"
              className="mt-1 w-full rounded-md border border-line bg-shell px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file && inputRef.current) {
              const transfer = new DataTransfer();
              transfer.items.add(file);
              inputRef.current.files = transfer.files;
            }
          }}
          className={`rounded-md border border-dashed p-6 text-center transition ${
            dragging ? 'border-moss bg-moss-soft' : 'border-line'
          }`}
        >
          <label htmlFor={fileId} className="block cursor-pointer text-sm">
            <span className="font-medium underline">Choose an image</span> or drop one here
          </label>
          <input
            ref={inputRef}
            id={fileId}
            name="file"
            form={formId}
            type="file"
            required
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="sr-only"
          />
          <p className="mt-1 text-xs text-muted">JPEG, PNG, WebP, AVIF or GIF · up to 8MB</p>
        </div>

        <button
          type="submit"
          form={formId}
          disabled={pending}
          className="rounded-md bg-ink px-4 py-2 text-sm text-porcelain disabled:opacity-60"
        >
          {pending ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {state ? (
        <p
          role="status"
          className={`mt-3 text-sm ${state.ok ? 'text-success' : 'text-danger'}`}
        >
          {state.message}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="size-20 rounded-md object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-success">Added to your media library</p>
            <p className="mt-0.5 text-xs text-muted">
              You can now use it on a product, a category, the homepage, or your branding.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(preview);
              setCopied(true);
            }}
            className="rounded-md border border-line px-3 py-2 text-sm"
          >
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      ) : null}

      {/*
        In compact mode the caller is attaching the image to the thing it is
        editing, so the only useful confirmation is that it is already done.
        The old copy here told the operator to reload the page and re-find the
        image, which is the round trip this component exists to remove.
      */}
      {preview && compact ? (
        <p className="mt-3 text-sm text-success">
          Uploaded. It is now selected above — set it as primary if you want it to be the
          picture on product cards.
        </p>
      ) : null}
    </div>
  );
}
