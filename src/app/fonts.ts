import { Fraunces, Inter } from 'next/font/google';

/**
 * Typography.
 *
 * A high-contrast display serif against a neutral grotesque: the pairing that
 * reads editorial rather than clinical, which is the intended voice.
 *
 * Defined here rather than in a layout because the storefront and admin roots
 * both need the variables, and a font module imported twice is still one font.
 */
export const display = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  axes: ['SOFT', 'WONK', 'opsz'],
});

export const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const fontVariables = `${display.variable} ${sans.variable}`;
