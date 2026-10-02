import 'server-only';

import { createAdminSupabaseClient } from './admin';
import { SUPABASE_URL } from './config';
import { registerMedia, type AdminMedia } from './admin-content';

/**
 * Supabase Storage.
 *
 * Prototype imagery is a set of remote URLs that are not owned by the business
 * and may disappear. Every admin upload writes a real object to a bucket and
 * records a row in `images` that the storefront references, so replacing an
 * asset is a data operation rather than a source edit.
 *
 * Uploads are validated before anything is written: an unvalidated file is the
 * cheapest way to fill a bucket with executables or 40-megabyte originals.
 */

export const PUBLIC_BUCKET = 'public';
export const PRIVATE_BUCKET = 'admin-private';

/**
 * Formats the storefront will render. SVG is deliberately excluded: it is a
 * script-bearing document format and is not needed for product photography.
 */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface UploadResult {
  ok: boolean;
  message: string;
  media?: AdminMedia;
}

/** Path segments are generated, so the only user-controlled part is a slug. */
function safeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60) || 'image';
}

function extensionFor(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/gif': 'gif',
  };
  return map[mime] ?? 'bin';
}

/**
 * Upload a file and register it in the media library.
 *
 * `folder` groups objects by purpose (`products`, `branding`, `homepage`,
 * `onboarding`, `categories`) so the bucket stays navigable. The object is
 * written first; the `images` row is only created if that succeeded, so a
 * failed upload cannot leave a row pointing at nothing.
 */
export async function uploadImage(
  file: File,
  options: { folder: string; alt: string; uploadedBy?: string },
): Promise<UploadResult> {
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, message: `${file.type || 'That file type'} is not a supported image.` };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message: `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 8MB.`,
    };
  }
  if (file.size === 0) {
    return { ok: false, message: 'That file is empty.' };
  }

  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured.' };
  }

  const id = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${safeSegment(options.folder)}/${id}.${extensionFor(file.type)}`;

  const body = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(path, body, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const { data: urlData } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path);

  try {
    await registerMedia({
      id,
      url: urlData.publicUrl,
      storagePath: path,
      alt: options.alt.slice(0, 200),
      mimeType: file.type,
      byteSize: file.size,
      uploadedBy: options.uploadedBy,
    });
  } catch (error) {
    // The object is orphaned without its row; remove it rather than leaving
    // an unreachable file occupying the bucket.
    await supabase.storage.from(PUBLIC_BUCKET).remove([path]);
    return { ok: false, message: error instanceof Error ? error.message : 'Could not register the image.' };
  }

  return {
    ok: true,
    message: 'Uploaded.',
    media: {
      id,
      url: urlData.publicUrl,
      storagePath: path,
      alt: options.alt,
      width: null,
      height: null,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Remove a stored object.
 *
 * The bucket is the source of truth for whether the bytes still exist: seed
 * rows carry an external URL and no `storage_path`, and deleting one of those
 * would be a no-op at best and a destructive mistake at worst.
 */
export async function deleteMedia(media: Pick<AdminMedia, 'id' | 'storagePath'>): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  if (media.storagePath) {
    const { error } = await supabase.storage.from(PUBLIC_BUCKET).remove([media.storagePath]);
    if (error) throw new Error(error.message);
  }

  const { error: rowError } = await supabase.from('images').delete().eq('id', media.id);
  if (rowError) throw new Error(rowError.message);
  return true;
}

/** Public URL for a stored path, for callers that hold only the path. */
export function publicUrlFor(path: string): string {
  return SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`
    : '';
}
