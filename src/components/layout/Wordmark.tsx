import type { Image } from '@/types';
import { cn } from '@/lib/utils/cn';

/**
 * Wordmark.
 *
 * Renders the uploaded logo when the admin has set one, and otherwise falls
 * back to a text wordmark. The text form is the default rather than a
 * placeholder: it scales, inherits colour, costs nothing to load, and keeps
 * working if the logo asset is ever removed.
 *
 * A plain `<img>` rather than `next/image`, because this is an admin-uploaded
 * asset served from Supabase Storage whose origin is not known at build time,
 * and a wordmark this small gains nothing from the optimiser.
 */
export function Wordmark({
  name,
  logo,
  className,
}: {
  name: string;
  logo?: Image | null;
  className?: string;
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo.url}
        alt={logo.alt || name}
        width={logo.width}
        height={logo.height}
        className={cn('h-7 w-auto object-contain lg:h-8', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'font-display text-xl font-normal uppercase leading-none tracking-[0.34em] text-ink lg:text-2xl',
        className,
      )}
    >
      {name}
    </span>
  );
}
