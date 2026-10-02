'use client';

import { useActionState } from 'react';
import { removeMedia, renameMedia, type MediaActionResult } from '@/lib/actions/admin';
import type { AdminMedia } from '@/lib/supabase/admin-content';

function Row({ media }: { media: AdminMedia }) {
  const [renameState, renameAction, renaming] = useActionState<MediaActionResult | null, FormData>(
    renameMedia,
    null,
  );
  const [deleteState, deleteAction, deleting] = useActionState<MediaActionResult | null, FormData>(
    removeMedia,
    null,
  );

  const gone = deleteState?.ok;

  return (
    <li className="flex flex-wrap items-start gap-4 rounded-lg border border-line bg-shell p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.url}
        alt={media.alt}
        className="size-16 shrink-0 rounded-md object-cover"
        loading="lazy"
      />

      <form action={renameAction} className="min-w-0 flex-1">
        <input type="hidden" name="id" value={media.id} />
        <label htmlFor={`alt-${media.id}`} className="block text-xs font-medium">
          Alt text
        </label>
        <input
          id={`alt-${media.id}`}
          name="alt"
          defaultValue={media.alt}
          required
          className="mt-1 w-full rounded-md border border-line bg-shell px-3 py-1.5 text-sm"
        />

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={renaming}
            className="rounded-md border border-line px-3 py-1 text-xs disabled:opacity-60"
          >
            {renaming ? 'Saving…' : 'Save alt'}
          </button>
          <span className="truncate font-mono text-xs text-muted">{media.url}</span>
        </div>

        {renameState ? (
          <p
            role="status"
            className={`mt-1 text-xs ${renameState.ok ? 'text-success' : 'text-danger'}`}
          >
            {renameState.message}
          </p>
        ) : null}
      </form>

      <form action={deleteAction}>
        <input type="hidden" name="id" value={media.id} />
        <input type="hidden" name="storage_path" value={media.storagePath ?? ''} />
        <button
          type="submit"
          disabled={deleting || gone}
          className="rounded-md border border-danger px-3 py-1 text-xs text-danger disabled:opacity-60"
        >
          {gone ? 'Deleted' : deleting ? 'Deleting…' : 'Delete'}
        </button>
      </form>
    </li>
  );
}

export function MediaLibrary({ media }: { media: AdminMedia[] }) {
  if (media.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-shell p-6">
        <h2 className="text-sm font-semibold">No images yet</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Nothing has been uploaded. The storefront is currently using seed URLs, which are
          placeholders rather than your own photography — uploading replaces them.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {media.map((item) => (
        <Row key={item.id} media={item} />
      ))}
    </ul>
  );
}
