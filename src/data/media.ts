import type { Image } from '@/types';

/**
 * Image factory for the current mock content layer.
 *
 * In production the admin panel writes these records directly and this
 * module disappears. Components only ever receive `Image` objects, never
 * raw URLs, so swapping the source changes nothing downstream.
 */
export function photo(pexelsId: number, alt: string, position = 0, isPrimary = position === 0): Image {
  return {
    id: `img-${pexelsId}-${position}`,
    url: `https://images.pexels.com/photos/${pexelsId}/pexels-photo-${pexelsId}.jpeg`,
    alt,
    position,
    isPrimary,
  };
}

/** Same asset, presented at a different gallery slot. */
export function photoAt(pexelsId: number, alt: string, position: number): Image {
  return photo(pexelsId, alt, position, false);
}

export function primary(image: Image): Image {
  return image.isPrimary ? image : { ...image, isPrimary: true };
}
