import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Icon, type IconName } from './Icon';
import { LinkButton } from './Button';

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon = 'search',
  title,
  body,
  action,
  secondaryAction,
  className,
  compact = false,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-3 px-6 py-12' : 'gap-4 px-6 py-20',
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-sand text-muted">
        <Icon name={icon} size={22} aria-hidden />
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <h2 className="font-display text-2xl text-ink">{title}</h2>
        {body && <p className="text-base leading-relaxed text-muted">{body}</p>}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          {action && <LinkButton href={action.href}>{action.label}</LinkButton>}
          {secondaryAction && (
            <LinkButton href={secondaryAction.href} variant="text">
              {secondaryAction.label}
            </LinkButton>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Error state                                                         */
/* ------------------------------------------------------------------ */

export function ErrorState({
  title = 'Something went wrong',
  body = 'We could not load this content. Please try again in a moment.',
  onRetry,
  className,
  compact = false,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-4 text-center',
        compact ? 'px-6 py-12' : 'px-6 py-20',
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
        <Icon name="info" size={22} aria-hidden />
      </span>
      <div className="max-w-md">
        <h2 className="font-display text-2xl text-ink">{title}</h2>
        <p className="mt-1.5 text-base leading-relaxed text-muted">{body}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-11 items-center gap-2 rounded-xs border border-ink/25 px-6 text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-shell"
        >
          <Icon name="refresh" size={15} aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeletons                                                           */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-xs', className)} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-[4/5] w-full" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading products"
      className={cn('grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4', className)}
    >
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
      <span className="sr-only">Loading products</span>
    </div>
  );
}

export function ProductPageSkeleton() {
  return (
    <div role="status" aria-label="Loading product" className="container-page py-10">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-[4/5] w-full" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="aspect-square w-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <span className="sr-only">Loading product</span>
    </div>
  );
}

export function CartPageSkeleton() {
  return (
    <div role="status" aria-label="Loading cart" className="container-page py-12">
      <Skeleton className="mb-8 h-9 w-40" />
      <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex gap-4 border-b border-line pb-6">
              <Skeleton className="size-28 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
      <span className="sr-only">Loading cart</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Breadcrumbs                                                         */
/* ------------------------------------------------------------------ */

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {item.href && !isLast ? (
                <Link href={item.href} className="link-underline transition-colors hover:text-ink">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className={cn(isLast && 'truncate text-ink')}>
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span aria-hidden className="text-line-strong">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

export function Pagination({
  page,
  totalPages,
  buildHref,
  className,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const window = 1;
  const pages: (number | 'gap')[] = [];
  for (let index = 1; index <= totalPages; index += 1) {
    const isEdge = index === 1 || index === totalPages;
    const isNear = Math.abs(index - page) <= window;
    if (isEdge || isNear) pages.push(index);
    else if (pages[pages.length - 1] !== 'gap') pages.push('gap');
  }

  const linkClass =
    'inline-flex size-10 items-center justify-center rounded-xs text-sm transition-colors duration-200';

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-1.5', className)}>
      <Link
        href={buildHref(Math.max(1, page - 1))}
        aria-disabled={page === 1}
        aria-label="Previous page"
        tabIndex={page === 1 ? -1 : undefined}
        className={cn(linkClass, 'border border-line', page === 1 ? 'pointer-events-none opacity-35' : 'hover:border-ink')}
      >
        <Icon name="chevron-left" size={16} aria-hidden />
      </Link>

      {pages.map((entry, index) =>
        entry === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden className="px-1.5 text-muted">
            &hellip;
          </span>
        ) : (
          <Link
            key={entry}
            href={buildHref(entry)}
            aria-current={entry === page ? 'page' : undefined}
            className={cn(
              linkClass,
              'border tabular-nums',
              entry === page ? 'border-ink bg-ink text-shell' : 'border-line hover:border-ink',
            )}
          >
            {entry}
          </Link>
        ),
      )}

      <Link
        href={buildHref(Math.min(totalPages, page + 1))}
        aria-disabled={page === totalPages}
        aria-label="Next page"
        tabIndex={page === totalPages ? -1 : undefined}
        className={cn(linkClass, 'border border-line', page === totalPages ? 'pointer-events-none opacity-35' : 'hover:border-ink')}
      >
        <Icon name="chevron-right" size={16} aria-hidden />
      </Link>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Inline notice                                                       */
/* ------------------------------------------------------------------ */

export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'border-info/20 bg-info-soft text-info',
    success: 'border-success/20 bg-success-soft text-success',
    warning: 'border-warning/20 bg-warning-soft text-warning',
    danger: 'border-danger/20 bg-danger-soft text-danger',
  } as const;

  return (
    <div role="status" className={cn('flex items-start gap-2.5 rounded-xs border px-3.5 py-3 text-sm', tones[tone], className)}>
      <Icon name="info" size={15} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </div>
  );
}
