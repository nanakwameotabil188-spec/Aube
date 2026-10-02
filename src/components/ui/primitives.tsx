import type { ReactNode } from 'react';
import type { BadgeTone, Money } from '@/types';
import { cn } from '@/lib/utils/cn';
import { discountPercent, formatMoney } from '@/lib/utils/format';

/* ------------------------------------------------------------------ */
/* Badge                                                               */
/* ------------------------------------------------------------------ */

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-sand text-ink-soft border-line',
  moss: 'bg-moss-soft text-moss-deep border-moss/20',
  clay: 'bg-clay-soft text-clay border-clay/25',
  danger: 'bg-danger-soft text-danger border-danger/20',
  ink: 'bg-ink text-shell border-ink',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-xs border px-2 py-0.5 text-2xs font-medium uppercase tracking-[0.12em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Price                                                               */
/* ------------------------------------------------------------------ */

export function Price({
  price,
  compareAtPrice,
  size = 'md',
  className,
}: {
  price: Money;
  compareAtPrice?: Money;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const percent = discountPercent(price, compareAtPrice);
  const scale = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  }[size];

  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <span className={cn('font-medium tabular-nums tracking-tight text-ink', scale)}>{formatMoney(price)}</span>
      {compareAtPrice && percent !== null && (
        <>
          <span className="text-sm tabular-nums text-muted line-through">{formatMoney(compareAtPrice)}</span>
          <span className="text-2xs font-medium uppercase tracking-[0.1em] text-clay">Save {percent}%</span>
        </>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Rating                                                              */
/* ------------------------------------------------------------------ */

/**
 * Star rating.
 *
 * Renders nothing but a plain "No reviews yet" when `value` is null, which is
 * the case for every product until a real review is approved. Showing a
 * zero-star graphic or a 0.0 would be as much of a fabrication as showing 4.8,
 * so the unrated state is stated in words instead of implied by empty stars.
 */
export function Rating({
  value,
  count,
  size = 14,
  showCount = true,
  className,
  emptyLabel = 'No reviews yet',
}: {
  value: number | null;
  count?: number;
  size?: number;
  showCount?: boolean;
  className?: string;
  emptyLabel?: string;
}) {
  if (value == null || count === 0) {
    return <span className={cn('text-xs text-muted', className)}>{emptyLabel}</span>;
  }

  const rounded = Math.round(value * 2) / 2;
  const label = `Rated ${value.toFixed(1)} out of 5${count != null ? ` from ${count} review${count === 1 ? '' : 's'}` : ''}`;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={label}>
      <span className="sr-only">{label}</span>
      <span aria-hidden className="inline-flex items-center gap-0.5 text-gold">
        {[1, 2, 3, 4, 5].map((step) => (
          <svg
            key={step}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={rounded >= step ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinejoin="round"
          >
            <path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.6Z" />
          </svg>
        ))}
      </span>
      {showCount && count != null && (
        <span aria-hidden className="text-xs tabular-nums text-muted">
          ({count.toLocaleString('en-US')})
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Stock pill                                                          */
/* ------------------------------------------------------------------ */

export type StockTone = 'in-stock' | 'low' | 'out-of-stock' | 'unavailable';

export function StockPill({ level, className }: { level: StockTone; className?: string }) {
  const copy: Record<StockTone, { label: string; className: string }> = {
    'in-stock': { label: 'In stock', className: 'text-success' },
    low: { label: 'Low stock', className: 'text-warning' },
    'out-of-stock': { label: 'Out of stock', className: 'text-danger' },
    unavailable: { label: 'Unavailable', className: 'text-muted' },
  };
  const entry = copy[level];

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', entry.className, className)}>
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full bg-current', level === 'in-stock' && 'animate-pulse')}
      />
      {entry.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Section header                                                      */
/* ------------------------------------------------------------------ */

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  cta,
  align = 'left',
  theme = 'default',
  className,
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  cta?: { label: string; href: string; style?: 'primary' | 'secondary' | 'text' };
  align?: 'left' | 'center';
  theme?: 'default' | 'sand' | 'moss' | 'ink' | 'oat';
  className?: string;
}) {
  const muted = theme === 'ink' || theme === 'moss';
  const centered = align === 'center';

  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        centered && 'sm:flex-col sm:items-center sm:text-center',
        className,
      )}
    >
      <div className={cn('flex max-w-2xl flex-col gap-2.5', centered && 'items-center')}>
        {eyebrow && (
          <p className={cn('eyebrow', muted && 'text-shell/70')}>
            <span className="mr-3 inline-block h-px w-6 translate-y-[-0.25em] bg-current align-middle opacity-60" />
            {eyebrow}
          </p>
        )}
        {title && (
          <h2
            className={cn(
              'font-display text-3xl leading-[1.12] sm:text-4xl',
              muted ? 'text-shell' : 'text-ink',
            )}
          >
            {title}
          </h2>
        )}
        {subtitle && (
          <p className={cn('max-w-xl text-md leading-relaxed', muted ? 'text-shell/75' : 'text-muted', centered && 'mx-auto')}>
            {subtitle}
          </p>
        )}
      </div>

      {cta && (
        <LinkUnderline
          href={cta.href}
          muted={muted}
          className={cn('shrink-0 self-start text-sm font-medium sm:self-end', centered && 'self-center')}
        >
          {cta.label}
        </LinkUnderline>
      )}
    </div>
  );
}

function LinkUnderline({
  href,
  children,
  muted,
  className,
}: {
  href: string;
  children: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        'link-underline inline-flex items-center gap-1.5',
        muted ? 'text-shell' : 'text-ink',
        className,
      )}
    >
      {children}
      <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
        &rarr;
      </span>
    </a>
  );
}
