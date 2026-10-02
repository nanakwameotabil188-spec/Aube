'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { OnboardingSlide } from '@/types';
import { cn } from '@/lib/utils/cn';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/overlays';
import { MediaImage } from '@/components/commerce/ProductGallery';

/**
 * First-visit introduction.
 *
 * Replaces the block of explanatory sections that used to sit in the middle of
 * the homepage. It is a short, dismissible sequence rather than a page: a
 * visitor who wants it can step through, and a visitor who does not can close
 * it once and never see it again.
 *
 * Accessibility: the dialog is a labelled `aria-modal` with the slide title as
 * its accessible name, the dot controls are real buttons carrying the slide
 * number, Escape skips, and arrow keys move between slides. Focus is not
 * trapped beyond what the shared `Modal` already provides.
 *
 * Dismissal is recorded in `localStorage` so this stays a one-time experience.
 * That is a presentation preference, not business data, so it does not belong
 * in Supabase.
 */

const STORAGE_KEY = 'aube.onboarding.v1';

function alreadySeen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'seen';
  } catch {
    // Private browsing and blocked storage both throw; treat as not seen.
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'seen');
  } catch {
    /* nothing to do; the sequence simply shows again next visit */
  }
}

export function OnboardingSequence({ slides }: { slides: OnboardingSlide[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  // Only enabled slides reach the visitor, in admin-defined order. An empty
  // result renders nothing at all — no empty popup.
  const visible = [...slides]
    .filter((slide) => slide.enabled)
    .sort((a, b) => a.position - b.position);

  useEffect(() => {
    if (visible.length === 0) return;
    // Defer so the dialog does not compete with first paint on a slow device.
    const timer = window.setTimeout(() => {
      if (!alreadySeen()) setOpen(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [visible.length]);

  const dismiss = useCallback(() => {
    markSeen();
    setOpen(false);
  }, []);

  const finish = useCallback(() => {
    markSeen();
    setOpen(false);
  }, []);

  const go = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= visible.length) {
        finish();
        return;
      }
      setIndex(next);
    },
    [visible.length, finish],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(index - 1);
    }
  };

  if (visible.length === 0) return null;

  const slide = visible[Math.min(index, visible.length - 1)];
  if (!slide) return null;

  const isLast = index === visible.length - 1;

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title={slide.title}
      size="sm"
      footer={
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={dismiss}
            className="text-sm text-muted transition-colors hover:text-ink"
          >
            Skip
          </button>

          <div className="flex items-center gap-3">
            {index > 0 && (
              <button
                type="button"
                onClick={() => go(index - 1)}
                className="rounded-md border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:border-line-strong"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="rounded-md bg-ink px-4 py-1.5 text-sm text-porcelain transition-colors hover:bg-ink-soft"
            >
              {isLast ? 'Get started' : 'Next'}
            </button>
          </div>
        </div>
      }
    >
      {/* Slides sit in a live region so a screen reader hears each new one. */}
      <div aria-live="polite" onKeyDown={onKeyDown}>
        {slide.image ? (
          <MediaImage
            image={slide.image}
            aspect="16/9"
            className="mb-5 overflow-hidden rounded-md"
            sizes="(min-width: 640px) 28rem, 100vw"
          />
        ) : slide.icon ? (
          <div className="mb-5 flex size-11 items-center justify-center rounded-full bg-moss-soft text-moss-deep">
            <Icon name={slide.icon} size={22} aria-hidden />
          </div>
        ) : null}

        {slide.eyebrow && <p className="eyebrow mb-2">{slide.eyebrow}</p>}
        <p className="text-md leading-relaxed text-muted">{slide.body}</p>

        {slide.ctaLabel && slide.ctaHref && (
          <p className="mt-5 text-sm text-muted">
            <Link href={slide.ctaHref} className="link-underline text-ink" onClick={finish}>
              {slide.ctaLabel}
            </Link>
          </p>
        )}
      </div>

      <nav aria-label="Introduction slides" className="mt-6 flex justify-center gap-2">
        {visible.map((item, dotIndex) => (
          <button
            key={item.id}
            type="button"
            onClick={() => go(dotIndex)}
            aria-current={dotIndex === index ? 'true' : undefined}
            aria-label={`Go to slide ${dotIndex + 1} of ${visible.length}: ${item.title}`}
            className={cn(
              'size-1.5 rounded-full transition-all duration-200',
              dotIndex === index ? 'scale-150 bg-ink' : 'bg-line-strong hover:bg-muted',
            )}
          />
        ))}
      </nav>
    </Modal>
  );
}
