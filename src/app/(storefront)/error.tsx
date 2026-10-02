'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/states';
import { routes } from '@/lib/routes';

/**
 * Route-level error boundary.
 *
 * Catches render and data failures below the layout, so the header, footer and
 * navigation stay usable while the broken segment is replaced. A service error
 * carries a shopper-safe message; anything else falls back to a generic one
 * rather than leaking a stack trace.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // In production this is where the error would be reported. Logging to the
    // console keeps it visible in development without shipping a reporter.
    console.error(error);
  }, [error]);

  return (
    <div className="container-page py-24">
      <ErrorState
        title="Something went wrong on this page"
        body="The rest of the store is still working. Try again, and if it keeps happening let us know."
        onRetry={reset}
        className="mx-auto max-w-md"
      />

      <div className="mt-10 flex justify-center gap-3">
        <a href={routes.home} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
          Back to home
        </a>
        <a href={routes.contact} className="text-sm text-muted underline underline-offset-2 hover:text-ink">
          Report the problem
        </a>
      </div>
    </div>
  );
}
