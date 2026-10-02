'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import type { Image as ImageRecord, Product } from '@/types';
import { cn } from '@/lib/utils/cn';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/primitives';

/**
 * Product gallery.
 *
 * Drives entirely from `product.images`, ordered by `position` and anchored
 * on `isPrimary` — so an admin reordering or replacing gallery images needs
 * no frontend change.
 *
 * Navigating to a different product remounts `Gallery` via its `key`, which
 * resets the selection and zoom to the new primary image. Resetting them in an
 * effect would paint one frame of the previous product's photo.
 */
export function ProductGallery({ product, className }: { product: Product; className?: string }) {
  const images = sortImages(product.images);
  if (images.length === 0) return null;

  return <Gallery key={product.id} productId={product.id} images={images} className={className} />;
}

function Gallery({
  productId,
  images,
  className,
}: {
  /** Used for the thumbgroup label; the `key` above is what resets the state. */
  productId: string;
  images: ImageRecord[];
  className?: string;
}) {
  const [index, setIndex] = useState(() => {
    const primary = images.findIndex((image) => image.isPrimary);
    return primary === -1 ? 0 : primary;
  });
  const [zoomed, setZoomed] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        setIndex((current) => (current + 1) % images.length);
      } else if (event.key === 'ArrowLeft') {
        setIndex((current) => (current - 1 + images.length) % images.length);
      }
    },
    [images.length],
  );

  const active = images[index] ?? images[0];
  if (!active) return null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        ref={frameRef}
        className="group/gallery relative aspect-4/5 overflow-hidden rounded-xs bg-sand"
        onMouseLeave={() => setZoomed(false)}
      >
        {images.map((image, imageIndex) => (
          <Image
            key={image.id}
            src={image.url}
            alt={image.alt}
            fill
            priority={imageIndex === 0}
            sizes="(min-width: 1024px) 48vw, 100vw"
            aria-hidden={imageIndex !== index}
            className={cn(
              'object-cover transition-opacity duration-500 ease-[var(--ease-soft)]',
              imageIndex === index ? 'opacity-100' : 'opacity-0',
              imageIndex === index && zoomed && 'scale-125 cursor-zoom-out',
              imageIndex === index && !zoomed && 'cursor-zoom-in',
            )}
          />
        ))}

        <button
          type="button"
          onClick={() => setZoomed((value) => !value)}
          aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
          aria-pressed={zoomed}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full border border-line/60 bg-shell/90 text-ink backdrop-blur-sm transition-colors hover:bg-shell"
        >
          <Icon name={zoomed ? 'minus' : 'search'} size={15} aria-hidden />
        </button>

        {images.length > 1 && (
          <>
            <GalleryArrow direction="left" onClick={() => setIndex((index - 1 + images.length) % images.length)} />
            <GalleryArrow direction="right" onClick={() => setIndex((index + 1) % images.length)} />
          </>
        )}

        <p className="absolute bottom-3 left-3 rounded-full bg-shell/90 px-2.5 py-1 text-2xs font-medium tabular-nums tracking-[0.1em] text-muted backdrop-blur-sm">
          {index + 1} / {images.length}
        </p>
      </div>

      {images.length > 1 && (
        <div
          role="group"
          aria-label="Product images"
          onKeyDown={onKeyDown}
          className="no-scrollbar flex gap-2.5 overflow-x-auto"
        >
          {images.map((image, imageIndex) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setIndex(imageIndex)}
              aria-label={`Show image ${imageIndex + 1}: ${image.alt}`}
              aria-current={imageIndex === index}
              tabIndex={imageIndex === index ? 0 : -1}
              className={cn(
                'relative aspect-square w-16 shrink-0 overflow-hidden rounded-xs border bg-sand transition-colors duration-300',
                imageIndex === index ? 'border-ink' : 'border-transparent opacity-65 hover:opacity-100',
              )}
            >
              <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function GalleryArrow({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'left' ? 'Previous image' : 'Next image'}
      className={cn(
        'absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-line/60',
        'bg-shell/90 text-ink backdrop-blur-sm transition-[opacity,background-color] duration-300 hover:bg-shell md:grid',
        'opacity-0 group-hover/gallery:opacity-100',
        direction === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <Icon name={direction === 'left' ? 'chevron-left' : 'chevron-right'} size={16} aria-hidden />
    </button>
  );
}

/** Order images by the admin-controlled `position`, primary first. */
export function sortImages(images: ImageRecord[]): ImageRecord[] {
  return images
    .slice()
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.position - b.position;
    });
}

/**
 * Simple image used by tiles, banners and editorial blocks.
 * Consistent treatment: neutral background, cover, rounded, lazy by default.
 */
export function MediaImage({
  image,
  sizes = '(min-width: 1024px) 33vw, 100vw',
  className,
  priority = false,
  aspect = '4/5',
  rounded = 'rounded-xs',
}: {
  image: ImageRecord;
  sizes?: string;
  className?: string;
  priority?: boolean;
  aspect?: '4/5' | '1/1' | '4/3' | '16/9' | '3/4';
  rounded?: string;
}) {
  const aspectClass = {
    '4/5': 'aspect-4/5',
    '1/1': 'aspect-square',
    '4/3': 'aspect-4/3',
    '16/9': 'aspect-16/9',
    '3/4': 'aspect-3/4',
  }[aspect];

  return (
    <div className={cn('relative overflow-hidden bg-sand', aspectClass, rounded, className)}>
      <Image
        src={image.url}
        alt={image.alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover transition-transform duration-700 ease-[var(--ease-soft)]"
      />
    </div>
  );
}

export function MediaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute left-3 top-3">
      <Badge tone="ink">{children}</Badge>
    </span>
  );
}
