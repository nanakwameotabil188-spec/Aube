import type { Metadata } from 'next';
import type { StoreSettings } from '@/types';

/**
 * Page metadata composition.
 *
 * Page metadata used to be a static `export const metadata` with the brand
 * name typed into the description, which meant renaming the business left
 * stale copy in search results and social cards. Route metadata is now built
 * from `StoreSettings` so the admin's edits reach it.
 *
 * The `title.template` set in the storefront layout already appends the brand
 * name to every page title, so these only supply the page-specific part.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? '';

export interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  image?: string;
  /** Suppress indexing for pages that should never rank, e.g. cart. */
  noIndex?: boolean;
}

export async function pageMetadata(
  settings: StoreSettings,
  input: PageMetaInput,
): Promise<Metadata> {
  const canonical = input.path === '/' ? '/' : `${SITE_URL}${input.path}`;
  const image = input.image ?? settings.shareImage?.url;

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical },
    ...(input.noIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: 'website',
      siteName: settings.brandName,
      title: input.title,
      description: input.description,
      url: canonical,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: input.title,
      description: input.description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
