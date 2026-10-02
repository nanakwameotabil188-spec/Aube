'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Reactive CSS media queries.
 *
 * The server has no viewport, so the snapshot during SSR and hydration is
 * `false`; `useSyncExternalStore` then applies the real value on the client.
 * Subscribing directly to the `MediaQueryList` means no effect and no
 * double render, and the listener is torn down by React rather than by a
 * hand-written cleanup.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // A stable `false` on the server: the first client render must match the
  // server HTML, and the corrected value arrives immediately after hydration.
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 64rem)');
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * `false` on the server and during the hydration render, `true` immediately
 * after. Client state restored from storage is not available until then, so
 * this is the correct gate for anything that must not flash stale content.
 */
export function useHydrated(): boolean {
  const subscribe = useCallback(() => () => {}, []);
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * `true` once the page has scrolled past `offset` pixels.
 *
 * Subscribing straight to the scroll event keeps the header's background in
 * sync without an effect that would run `setState` on every frame batch.
 * Scroll position is unknowable on the server, so the first paint is `false`.
 */
export function useScrolledPast(offset = 24): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined') return () => {};
      window.addEventListener('scroll', onChange, { passive: true });
      return () => window.removeEventListener('scroll', onChange);
    },
    [],
  );

  // `getSnapshot` is called while rendering, including on the server, so it
  // must not touch `window` unguarded. Returning a boolean keeps the result
  // referentially stable across repeated calls.
  const getSnapshot = useCallback(
    () => (typeof window === 'undefined' ? false : window.scrollY > offset),
    [offset],
  );
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
