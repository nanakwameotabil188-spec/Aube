'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setProductVisibility } from '@/lib/actions/admin';
import { cn } from '@/lib/utils/cn';

/**
 * Flips a product's storefront visibility without leaving the list.
 *
 * `useOptimistic` is not used here on purpose: the server action revalidates
 * `/shop`, so the list refreshes from the database, which is the value that
 * actually matters. An optimistic guess would briefly show the wrong state if
 * the write failed.
 */
export function ProductVisibilityToggle({
  id,
  name,
  visible,
}: {
  id: string;
  name: string;
  visible: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          formData.set('id', id);
          formData.set('visible', visible ? 'false' : 'true');
          await setProductVisibility(null, formData);
          router.refresh();
        })
      }
    >
      <button
        type="submit"
        disabled={pending}
        aria-label={visible ? `Hide ${name}` : `Show ${name}`}
        className={cn(
          'inline-block rounded-xs px-2 py-0.5 text-xs transition-colors',
          visible ? 'bg-success-soft text-success' : 'bg-sand text-muted',
          pending && 'opacity-60',
        )}
      >
        {visible ? 'Visible' : 'Hidden'}
      </button>
    </form>
  );
}
