import type { SVGProps } from 'react';
import type { IconGlyph } from '@/types';

/**
 * Icon set.
 *
 * Hand-rolled rather than pulled from a library: the storefront needs
 * twenty-four glyphs, and a consistent stroke weight matters more here than
 * the breadth an icon package would add to the bundle.
 */

const PATHS: Record<IconGlyph, string> = {
  cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h7.9a1 1 0 0 0 1-.8L19 8H6M10 20a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2ZM17 20a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2Z',
  heart:
    'M12 20.2S4 15.6 4 9.9A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 8 2.3c0 5.7-8 10.3-8 10.3Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM16 16l4 4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  menu: 'M3.5 7h17M3.5 12h17M3.5 17h17',
  close: 'M6 6l12 12M18 6L6 18',
  'chevron-down': 'm6 9.5 6 6 6-6',
  'chevron-right': 'm9.5 6 6 6-6 6',
  'chevron-left': 'm14.5 6-6 6 6 6',
  'arrow-right': 'M4 12h16M14 6l6 6-6 6',
  'arrow-left': 'M20 12H4M10 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  star: 'M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.6Z',
  filter: 'M4 6h16M7 12h10M10 18h4',
  truck: 'M3 7h11v9H3zM14 10h3.5l2.5 3v3h-6M7 19a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 7 19ZM17.5 19a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z',
  leaf: 'M5 19c0-8 5-13 14-13 0 9-5 14-13 14H5ZM8 16c2.5-3.5 5.5-5.5 8.5-6.5',
  droplet: 'M12 3.5s6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 6-10 6-10Z',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z',
  shield: 'M12 3l7 3v5.5c0 4.3-2.9 7.9-7 9.5-4.1-1.6-7-5.2-7-9.5V6l7-3Z',
  flask: 'M10 3v6.2L4.8 18a2 2 0 0 0 1.7 3h11a2 2 0 0 0 1.7-3L14 9.2V3M9 3h6M7.2 14h9.6',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  wind: 'M3 8h9a2.5 2.5 0 1 0-2.5-2.5M3 12h13a2.5 2.5 0 1 1-2.5 2.5M3 16h6',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9L17.5 7M10 10.5v6M14 10.5v6',
  refresh: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  rows: 'M4 5h16v5H4zM4 14h16v5H4z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.6h.01',
  /** Notification bell. Added with the in-app notifications feature. */
  bell: 'M18 15.5V10a6 6 0 1 0-12 0v5.5L4.5 18h15L18 15.5ZM9.8 20.5a2.3 2.3 0 0 0 4.4 0',
  lock: 'M6.5 10.5h11v9h-11zM8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7',
  package: 'M20 8.5 12 4 4 8.5v7L12 20l8-4.5v-7ZM4 8.5l8 4.5 8-4.5M12 13v7',
  gift: 'M4 11h16v9H4zM4 7.5h16V11H4zM12 7.5V20M12 7.5S10.6 3 8.4 3a2.2 2.2 0 0 0 0 4.5H12ZM12 7.5s1.4-4.5 3.6-4.5a2.2 2.2 0 0 1 0 4.5H12Z',
  instagram:
    'M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4ZM12 15.6a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2ZM17 7.1h.01',
};

/** Glyphs available on `Icon`, kept aligned with `ICON_NAMES`. */
export type IconName = keyof typeof PATHS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Filled glyphs are used for the active wishlist heart and rated stars. */
  filled?: boolean;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, filled = false, strokeWidth = 1.5, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={props['aria-label'] ? undefined : true}
      focusable="false"
      {...props}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export { PATHS as ICON_PATHS };
