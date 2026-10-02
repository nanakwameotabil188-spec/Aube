'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { Icon } from './Icon';
import { useEscapeKey } from '@/lib/hooks';

/* ------------------------------------------------------------------ */
/* Accordion                                                           */
/* ------------------------------------------------------------------ */

export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
}

/**
 * Accordion built on native `<details>`-like semantics with buttons, so
 * Enter/Space work, headings are navigable, and the open state is announced.
 */
export function Accordion({
  items,
  allowMultiple = true,
  className,
}: {
  items: AccordionItem[];
  allowMultiple?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState<string[]>(items.filter((item) => item.defaultOpen).map((item) => item.id));
  const baseId = useId();

  const toggle = (id: string) => {
    setOpen((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return allowMultiple ? [...current, id] : [id];
    });
  };

  return (
    <div className={cn('divide-y divide-line border-y border-line', className)}>
      {items.map((item) => {
        const isOpen = open.includes(item.id);
        return (
          <div key={item.id} className="group/accordion">
            <h3>
              <button
                type="button"
                id={`${baseId}-trigger-${item.id}`}
                aria-expanded={isOpen}
                aria-controls={`${baseId}-panel-${item.id}`}
                disabled={item.disabled}
                onClick={() => toggle(item.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-4 py-4 text-left',
                  'text-md font-medium text-ink transition-colors duration-200 hover:text-moss',
                  'disabled:cursor-not-allowed disabled:text-muted disabled:hover:text-muted',
                )}
              >
                <span className="flex-1">{item.title}</span>
                <span className="flex shrink-0 items-center gap-3">
                  {item.meta}
                  <Icon
                    name="chevron-down"
                    size={16}
                    aria-hidden
                    className={cn('text-muted transition-transform duration-300 ease-[var(--ease-soft)]', isOpen && 'rotate-180')}
                  />
                </span>
              </button>
            </h3>
            <div
              id={`${baseId}-panel-${item.id}`}
              role="region"
              aria-labelledby={`${baseId}-trigger-${item.id}`}
              hidden={!isOpen}
              className="animate-fade pb-5 text-base leading-relaxed text-muted"
            >
              {item.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

/**
 * Slide-in panel used for the cart, mobile navigation and filter sheets.
 * Focus is trapped, Escape closes, and the background is inert to
 * assistive technology while open.
 */
export function Drawer({
  open,
  onClose,
  title,
  side = 'right',
  children,
  footer,
  label,
  widthClass = 'w-full max-w-md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  side?: 'right' | 'left';
  children: ReactNode;
  footer?: ReactNode;
  label?: string;
  widthClass?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEscapeKey(onClose, open);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const timer = window.setTimeout(() => {
      const items = panelRef.current?.querySelectorAll<HTMLElement>(selector);
      items?.[0]?.focus();
    }, 60);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>(selector);
      if (!items || items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-80" role="presentation">
      <button
        type="button"
        aria-label={label ?? 'Close panel'}
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'absolute inset-y-0 flex animate-slide-left flex-col bg-porcelain shadow-overlay',
          side === 'right' ? 'right-0' : 'left-0',
          widthClass,
        )}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <h2 id={titleId} className="font-display text-xl text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-full p-2 text-ink transition-colors hover:bg-sand"
            aria-label="Close"
          >
            <Icon name="close" size={18} aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>

        {footer && <div className="border-t border-line bg-shell px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEscapeKey(onClose, open);

  useEffect(() => {
    if (open) window.setTimeout(() => panelRef.current?.focus(), 40);
  }, [open]);

  if (!open) return null;

  const maxWidth = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size];

  return (
    <div className="fixed inset-0 z-80 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'animate-scale-in relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-porcelain shadow-overlay focus:outline-none',
          'rounded-t-lg sm:rounded-lg',
          maxWidth,
        )}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-5">
          <h2 id={titleId} className="font-display text-2xl text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-full p-2 text-ink transition-colors hover:bg-sand"
            aria-label="Close"
          >
            <Icon name="close" size={18} aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer && <div className="border-t border-line bg-shell px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ items, className }: { items: TabItem[]; className?: string }) {
  const [active, setActive] = useState(items[0]?.id ?? '');
  const baseId = useId();

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = items.findIndex((item) => item.id === active);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = (index + delta + items.length) % items.length;
      const target = items[next];
      if (target) {
        setActive(target.id);
        document.getElementById(`${baseId}-tab-${target.id}`)?.focus();
      }
    }
  };

  const current = items.find((item) => item.id === active);

  return (
    <div className={className}>
      <div role="tablist" aria-label="Content sections" onKeyDown={onKeyDown} className="flex gap-6 border-b border-line">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(item.id)}
              className={cn(
                'relative -mb-px border-b-2 pb-3 text-sm font-medium transition-colors duration-200',
                selected ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {current && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${current.id}`}
          aria-labelledby={`${baseId}-tab-${current.id}`}
          tabIndex={0}
          className="animate-fade pt-6 focus:outline-none"
        >
          {current.content}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quantity stepper                                                    */
/* ------------------------------------------------------------------ */

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  label = 'Quantity',
  size = 'md',
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center border border-line bg-shell',
        size === 'sm' ? 'h-9' : 'h-11',
        disabled && 'opacity-45',
      )}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className="grid size-full w-9 place-items-center text-ink transition-colors hover:bg-sand disabled:opacity-30"
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <Icon name="minus" size={14} aria-hidden />
      </button>
      <span
        aria-live="polite"
        aria-label={`${label}: ${value}`}
        className="min-w-8 text-center text-sm tabular-nums text-ink"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className="grid size-full w-9 place-items-center text-ink transition-colors hover:bg-sand disabled:opacity-30"
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <Icon name="plus" size={14} aria-hidden />
      </button>
    </div>
  );
}
