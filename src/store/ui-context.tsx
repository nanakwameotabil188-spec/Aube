'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Global overlay state.
 *
 * Cart drawer, search overlay and mobile navigation are mutually exclusive
 * overlays, so they share one context rather than three competing flags.
 *
 * Each overlay records the path it was opened on. Navigating therefore closes
 * every overlay as a *derivation* — `overlay` is null whenever the recorded
 * path no longer matches — instead of an effect that closes them a render
 * late, which would otherwise flash the open drawer over the new page.
 */

export type OverlayId = 'cart' | 'search' | 'mobile-nav' | 'filters';

interface UIContextValue {
  overlay: OverlayId | null;
  open: (id: OverlayId) => void;
  close: () => void;
  isOpen: (id: OverlayId) => boolean;
  toggle: (id: OverlayId) => void;
  /** Signals that content behind the current overlay needs a scroll lock. */
  locked: boolean;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<{ id: OverlayId; path: string } | null>(null);

  // The single point where "navigation happened" is accounted for.
  const overlay = state && state.path === pathname ? state.id : null;

  const open = (id: OverlayId) => setState({ id, path: pathname });

  const close = () => setState(null);

  const isOpen = (id: OverlayId) => overlay === id;

  const toggle = (id: OverlayId) =>
    setState((current) => {
      if (current && current.path === pathname && current.id === id) return null;
      return { id, path: pathname };
    });

  const value: UIContextValue = { overlay, open, close, isOpen, toggle, locked: overlay !== null };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used inside <UIProvider>.');
  return context;
}
