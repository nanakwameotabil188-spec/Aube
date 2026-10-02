import type { Image, Money } from '@/types';

/**
 * Build a delivery URL for an image at a requested width.
 *
 * Components should pass plain `next/image` sources around and let the Next
 * image optimiser handle sizing. This helper exists for the cases where a
 * bare URL is unavoidable: Open Graph tags, JSON-LD, CSS backgrounds and
 * e-mail previews.
 *
 * Only hosts that actually implement a transform get query parameters. The
 * previous version appended Imgix's `auto=compress&cs=tinysrgb&w=` to every
 * URL, which Pexels and Supabase Storage both ignore — so it shipped dead
 * query strings and implied a resizing that never happened. Supabase Storage
 * is served through Next's image optimiser instead, and unknown hosts get
 * their URL back untouched.
 */
export function imageUrl(image: Image | undefined, width = 1200): string {
  if (!image) return '';

  // Imgix-backed CDNs (and Cloudinary-style `?w=`) honour width parameters.
  if (/(?:^|\.)imgix\.net/.test(image.url) || /res\.cloudinary\.com/.test(image.url)) {
    const separator = image.url.includes('?') ? '&' : '?';
    return `${image.url}${separator}auto=compress&cs=tinysrgb&w=${width}`;
  }

  return image.url;
}

/** Aspect ratio hints for reserving layout space and avoiding CLS. */
export const ASPECT = {
  portrait: 4 / 5,
  square: 1,
  landscape: 4 / 3,
  wide: 16 / 9,
} as const;
