'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Announcement, NavLink, StoreSettings } from '@/types';
import { cn } from '@/lib/utils/cn';
import { routes } from '@/lib/routes';
import { Icon } from '@/components/ui/Icon';
import { MegaMenu } from './MegaMenu';
import { useUI } from '@/store/ui-context';
import { useCart } from '@/store/cart-context';
import { useWishlist } from '@/store/wishlist-context';
import { useClickOutside, useEscapeKey, useHasFocusWithin } from '@/lib/hooks';
import { useScrolledPast } from '@/lib/hooks/use-media-query';
import { Wordmark } from './Wordmark';

/**
 * Site header.
 *
 * Sticky, transparent-on-hero then solid once scrolled. Desktop exposes a
 * hover-and-focus mega menu; mobile uses a full-height drawer with
 * accordion groups. Both read the same `NavLink` tree.
 */

export function Header({
  settings,
  nav,
  announcements,
}: {
  settings: StoreSettings;
  nav: NavLink[];
  announcements: Announcement[];
}) {
  const pathname = usePathname();
  const scrolled = useScrolledPast(24);
  // The mega menu records the path it was opened on, so navigating away closes
  // it as a derivation rather than an effect running one render too late.
  const [menu, setMenu] = useState<{ id: string; path: string } | null>(null);
  const activeMenu = menu && menu.path === pathname ? menu.id : null;
  const navRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const { open, close, isOpen } = useUI();
  const { count: cartCount } = useCart();
  const { count: wishlistCount } = useWishlist();

  const focusWithinNav = useHasFocusWithin(navRef);
  const menuIsActive = activeMenu !== null;

  const closeMenu = useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setMenu(null);
  }, []);

  // Give the pointer time to travel into the panel before dismissing.
  const openMenu = useCallback(
    (id: string) => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
      setMenu({ id, path: pathname });
    },
    [pathname],
  );

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setMenu(null), 140);
  }, []);

  useClickOutside(navRef, closeMenu, menuIsActive);
  useEscapeKey(closeMenu, menuIsActive);

  const activeItem = nav.find((item) => item.id === activeMenu) ?? null;

  return (
    <>
      <AnnouncementBar announcements={announcements} />

      <header
        className={cn(
          'sticky top-0 z-70 border-b transition-[background-color,border-color,box-shadow] duration-400 ease-[var(--ease-soft)]',
          scrolled || menuIsActive
            ? 'border-line bg-porcelain/95 shadow-soft backdrop-blur-md'
            : 'border-transparent bg-porcelain',
        )}
      >
        <div className="container-page">
          <div className="flex h-16 items-center justify-between gap-4 lg:h-18">
            <div className="flex flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => open('mobile-nav')}
                className="-ml-2 grid size-10 place-items-center rounded-xs text-ink transition-colors hover:bg-sand lg:hidden"
                aria-label="Open menu"
                aria-expanded={isOpen('mobile-nav')}
              >
                <Icon name="menu" size={20} aria-hidden />
              </button>

              <nav aria-label="Primary" className="hidden lg:block" ref={navRef}>
                <ul className="flex items-center gap-1">
                  {nav.map((item) => {
                    const isActive = item.id === activeMenu;
                    return (
                      <li
                        key={item.id}
                        onMouseEnter={() => (item.children ? openMenu(item.id) : scheduleClose())}
                        onMouseLeave={item.children ? scheduleClose : undefined}
                      >
                        <Link
                          href={item.href}
                          aria-expanded={item.children ? isActive : undefined}
                          aria-haspopup={item.children ? 'true' : undefined}
                          onFocus={() => item.children && openMenu(item.id)}
                          onClick={() => item.children && setMenu(null)}
                          className={cn(
                            'flex h-10 items-center gap-1 rounded-xs px-3 text-sm transition-colors duration-200',
                            isActive || focusWithinNav ? 'text-ink' : 'text-ink-soft hover:text-ink',
                          )}
                        >
                          {item.label}
                          {item.children && (
                            <Icon
                              name="chevron-down"
                              size={13}
                              aria-hidden
                              className={cn('transition-transform duration-300', isActive && 'rotate-180')}
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>

            <Link
              href={routes.home}
              className="shrink-0 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
              aria-label={`${settings.brandName} — home`}
            >
              <Wordmark name={settings.brandName} logo={settings.logo} />
            </Link>

            <ul className="flex flex-1 items-center justify-end gap-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => open('search')}
                  aria-label="Search the store"
                  className="grid size-10 place-items-center rounded-xs text-ink transition-colors hover:bg-sand"
                >
                  <Icon name="search" size={19} aria-hidden />
                </button>
              </li>
              <li className="hidden sm:block">
                <IconNavLink href={routes.wishlist} label="Wishlist" badge={wishlistCount}>
                  <Icon name="heart" size={19} aria-hidden />
                </IconNavLink>
              </li>
              {/*
                The account link points at the sign-in page rather than at
                /account. For a signed-out visitor /account renders the same
                panel, and going there first would look like a dead end; for a
                signed-in one the page redirects onward to their overview.
              */}
              <li>
                <IconNavLink href={routes.account.login} label="Account">
                  <Icon name="user" size={19} aria-hidden />
                </IconNavLink>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => open('cart')}
                  aria-label={`Open bag${cartCount > 0 ? `, ${cartCount} item${cartCount === 1 ? '' : 's'}` : ', empty'}`}
                  className="relative grid size-10 place-items-center rounded-xs text-ink transition-colors hover:bg-sand"
                >
                  <Icon name="cart" size={19} aria-hidden />
                  {cartCount > 0 && <CountBadge count={cartCount} />}
                </button>
              </li>
            </ul>
          </div>
        </div>

        {activeItem && <MegaMenu item={activeItem} onNavigate={closeMenu} />}
      </header>

      <MobileNav nav={nav} settings={settings} onClose={() => close()} />
    </>
  );
}

function IconNavLink({
  href,
  label,
  badge,
  className,
  children,
}: {
  href: string;
  label: string;
  badge?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={badge ? `${label}, ${badge} item${badge === 1 ? '' : 's'}` : label}
      className={cn(
        'relative grid size-10 place-items-center rounded-xs text-ink transition-colors hover:bg-sand',
        className,
      )}
    >
      {children}
      {badge != null && badge > 0 && <CountBadge count={badge} />}
    </Link>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      aria-hidden
      className="absolute -right-0.5 -top-0.5 grid min-w-4.5 place-items-center rounded-full bg-moss px-1 text-[0.625rem] font-medium tabular-nums leading-4 text-shell"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Announcement bar                                                    */
/* ------------------------------------------------------------------ */

function AnnouncementBar({ announcements }: { announcements: Announcement[] }) {
  const [index, setIndex] = useState(0);
  const visible = announcements.filter((item) => item.visible);

  useEffect(() => {
    if (visible.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % visible.length), 6000);
    return () => window.clearInterval(timer);
  }, [visible.length]);

  if (visible.length === 0) return null;
  const current = visible[index % visible.length];
  if (!current) return null;

  const content = <span className="text-2xs font-medium tracking-[0.16em] uppercase">{current.message}</span>;

  return (
    <div className="bg-ink text-shell">
      <div className="container-page flex h-9 items-center justify-center gap-3 overflow-hidden">
        {current.href ? (
          <Link href={current.href} className="transition-opacity hover:opacity-80">
            {content}
          </Link>
        ) : (
          content
        )}
        {visible.length > 1 && (
          <span aria-hidden className="flex items-center gap-1.5">
            {visible.map((item, itemIndex) => (
              <span
                key={item.id}
                className={cn(
                  'size-1 rounded-full transition-colors duration-300',
                  itemIndex === index % visible.length ? 'bg-shell/80' : 'bg-shell/25',
                )}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile navigation                                                   */
/* ------------------------------------------------------------------ */

function MobileNav({ nav, settings, onClose }: { nav: NavLink[]; settings: StoreSettings; onClose: () => void }) {
  const { isOpen } = useUI();
  const open = isOpen('mobile-nav');
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? nav.filter((item) => item.label.toLowerCase().includes(query.toLowerCase().trim()))
    : nav;

  return (
    <div
      className={cn(
        'fixed inset-0 top-0 z-90 flex flex-col bg-porcelain transition-transform duration-400 ease-[var(--ease-soft)] lg:hidden',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
      aria-hidden={!open}
      {...(!open ? { inert: '' as unknown as boolean } : {})}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
        <Wordmark name={settings.brandName} logo={settings.logo} />
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 grid size-10 place-items-center rounded-xs text-ink"
          aria-label="Close menu"
          tabIndex={open ? 0 : -1}
        >
          <Icon name="close" size={20} aria-hidden />
        </button>
      </div>

      <div className="border-b border-line px-5 py-4">
        <label htmlFor="mobile-nav-search" className="sr-only">
          Search the store
        </label>
        {/* Filters the menu below as you type, and submits to the full results
            page on Enter, so the field is not only a nav filter. */}
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const term = query.trim();
            if (!term) return;
            onClose();
            router.push(`${routes.search}?q=${encodeURIComponent(term)}`);
          }}
          className="relative"
        >
          <Icon name="search" size={16} aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="mobile-nav-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            className="h-11 w-full rounded-xs border border-line bg-shell pl-10 pr-3 text-base placeholder:text-muted-light focus:border-ink focus:outline-none"
            tabIndex={open ? 0 : -1}
          />
        </form>
      </div>

      <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-5 py-2">
        <ul>
          {filtered.map((item) => {
            const hasChildren = Boolean(item.children?.length);
            const isExpanded = expanded === item.id;
            return (
              <li key={item.id} className="border-b border-line">
                <div className="flex items-center justify-between">
                  <Link
                    href={item.href}
                    onClick={onClose}
                    tabIndex={open ? 0 : -1}
                    className="flex-1 py-4 font-display text-xl text-ink"
                  >
                    {item.label}
                  </Link>
                  {hasChildren && (
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : item.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`mobile-nav-group-${item.id}`}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.label}`}
                      tabIndex={open ? 0 : -1}
                      className="grid size-11 place-items-center text-ink"
                    >
                      <Icon
                        name="plus"
                        size={16}
                        aria-hidden
                        className={cn('transition-transform duration-300', isExpanded && 'rotate-45')}
                      />
                    </button>
                  )}
                </div>

                {hasChildren && (
                  <ul
                    id={`mobile-nav-group-${item.id}`}
                    hidden={!isExpanded}
                    className="animate-fade space-y-3 pb-4 pl-4"
                  >
                    <li>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        tabIndex={open ? 0 : -1}
                        className="text-sm text-muted"
                      >
                        All {item.label.toLowerCase()}
                      </Link>
                    </li>
                    {item.children?.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={child.href}
                          onClick={onClose}
                          tabIndex={open ? 0 : -1}
                          className="block py-0.5 text-sm text-ink-soft"
                        >
                          {child.label}
                        </Link>
                        {child.children && (
                          <ul className="mt-1.5 space-y-1.5 pl-4">
                            {child.children.map((grandchild) => (
                              <li key={grandchild.id}>
                                <Link
                                  href={grandchild.href}
                                  onClick={onClose}
                                  tabIndex={open ? 0 : -1}
                                  className="text-sm text-muted"
                                >
                                  {grandchild.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <ul className="mt-8 space-y-4 pb-8">
          {[
            { href: routes.account.login, label: 'Account' },
            { href: routes.wishlist, label: 'Wishlist' },
            { href: routes.shop, label: 'All products' },
            { href: routes.faq, label: 'Help & FAQ' },
            { href: routes.contact, label: 'Contact' },
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onClose}
                tabIndex={open ? 0 : -1}
                className="text-sm text-muted"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
