import { Skeleton } from '@/components/ui/states';

/**
 * Route-level loading skeleton.
 *
 * Only mounted on the routes that need it: `/shop`, `/search` and `/checkout`.
 *
 * This is deliberately *not* a root `app/loading.tsx`. A loading boundary at
 * the app root makes every route stream a 200 shell before its own render
 * finishes, so a `notFound()` thrown during that render can no longer set the
 * response status. The result is a soft 200 "page not found" on `/category/foo`
 * and friends, which search engines read as real pages. Scoping the boundary to
 * routes that never 404 keeps both behaviours correct.
 */
export function RouteSkeleton() {
  return (
    <div className="container-page py-10 sm:py-14" aria-busy="true">
      <span className="sr-only">Loading</span>

      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-5 h-12 w-3/4 max-w-xl" />
      <Skeleton className="mt-4 h-5 w-full max-w-md" />

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3">
            <Skeleton className="aspect-4/5 w-full rounded-xs" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
