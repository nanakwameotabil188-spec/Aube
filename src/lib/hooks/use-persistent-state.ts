import { useCallback, useRef, useSyncExternalStore } from 'react';

/**
 * localStorage as a React external store.
 *
 * Reading storage in an effect and calling `setState` is the usual way to
 * persist client state, but it renders twice on every mount and depends on
 * render order to stay correct. `useSyncExternalStore` is built for exactly
 * this: the store is read during render, the server snapshot keeps the first
 * paint consistent with the server HTML, and React swaps in the stored value
 * immediately after hydration without a mismatch warning.
 *
 * Snapshots must be referentially stable, so parsed values are cached here
 * rather than re-parsed on every `getSnapshot` call.
 */

type Listener = () => void;

const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<Listener>>();

/** Cache of which keys exist in storage, so cross-tab writes can be detected. */
const keySnapshot = new Map<string, string | null>();

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function read<T>(key: string): T | undefined {
  if (cache.has(key)) return cache.get(key) as T | undefined;
  if (typeof window === 'undefined') return undefined;

  let value: T | undefined;
  try {
    const raw = window.localStorage.getItem(key);
    keySnapshot.set(key, raw);
    value = raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    // Corrupt payload: behave as if nothing was stored.
    keySnapshot.set(key, null);
    value = undefined;
  }

  cache.set(key, value);
  return value;
}

function write<T>(key: string, value: T) {
  cache.set(key, value);
  if (typeof window !== 'undefined') {
    try {
      if (value === undefined) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota exceeded or private mode: the in-memory cache still works for
      // this session, which is the behaviour a shopper expects.
    }
  }
  notify(key);
}

/**
 * Keeps tabs in sync. `storage` only fires in *other* tabs, and only for keys
 * they change, so the cache entry is dropped to force a re-read on next access.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (!event.key) return;
    cache.delete(event.key);
    keySnapshot.delete(event.key);
    notify(event.key);
  });
}

/**
 * State backed by `localStorage`.
 *
 * Returns the value, a `useState`-shaped setter, and a `ready` flag. `ready`
 * is false only during the server render and the hydration render; consumers
 * that must avoid a flash of stale content can gate on it.
 */
export function usePersistentValue<T>(key: string, initial: T) {
  // Captured once so the server snapshot keeps a stable identity across
  // renders, which `useSyncExternalStore` requires.
  const initialRef = useRef(initial);

  const subscribe = useCallback(
    (listener: Listener) => {
      const set = listeners.get(key) ?? new Set<Listener>();
      set.add(listener);
      listeners.set(key, set);
      return () => {
        set.delete(listener);
      };
    },
    [key],
  );

  // `getSnapshot` runs on the client immediately after hydration, unlike
  // `getServerSnapshot`, and `read` returns `undefined` when the key has never
  // been written. It must therefore fall back to the initial value itself:
  // without that, a first-time visitor gets `undefined` instead of the empty
  // state they are supposed to start from, and every consumer that maps over
  // the value throws.
  const getSnapshot = useCallback(() => {
    const stored = read<T>(key);
    return (stored === undefined ? initialRef.current : stored) as T;
  }, [key]);

  const getServerSnapshot = useCallback(() => initialRef.current, []);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) as T;

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      // Resolved the same way as `getSnapshot`. An explicit `undefined` check
      // rather than `??` so a deliberately stored `null` survives — the shipping
      // method key stores `null` to mean "none chosen".
      const stored = cache.has(key) ? (cache.get(key) as T | undefined) : undefined;
      const current = (stored === undefined ? initialRef.current : stored) as T;
      write(key, typeof next === 'function' ? (next as (previous: T) => T)(current) : next);
    },
    [key],
  );

  return [value, setValue, true] as const;
}

/** `useState`-shaped alias, for callers that prefer the familiar name. */
export function usePersistentState<T>(key: string, initial: T) {
  return usePersistentValue<T>(key, initial);
}

/** Test seam: drops the module-level cache so a fresh store can be simulated. */
export function resetStorageCache() {
  cache.clear();
  keySnapshot.clear();
}
