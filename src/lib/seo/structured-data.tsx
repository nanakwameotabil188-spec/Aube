import type { Product } from '@/types';

/** One entry in a visible breadcrumb trail. */
export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Structured data.
 *
 * Serialised through a `<script type="application/ld+json">` rather than
 * rendered client-side, so crawlers see it in the initial HTML. Every helper
 * returns a plain object; `JsonLd` handles the escaping, which is the part
 * worth being careful about — a stray `<` in a string would otherwise close the
 * script tag early.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aube.com';

export function organizationLd(brandName: string, legalName: string, social: { platform: string; url: string }[] = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: brandName,
    legalName,
    url: SITE_URL,
    sameAs: social.map((item) => item.url),
  };
}

export function websiteLd(brandName: string, tagline: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: brandName,
    url: SITE_URL,
    description: tagline,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbLd(entries: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.label,
      ...(entry.href ? { item: `${SITE_URL}${entry.href}` } : {}),
    })),
  };
}

export function productLd(product: Product, { reviews = [], rating }: { reviews?: { rating: number }[]; rating?: number } = {}) {
  // Offer price comes from the variants that can actually be bought, not the
  // headline price, so the schema never under-reports what a shopper pays.
  const buyable = product.variants.filter((variant) => variant.stockQuantity > 0);
  const lowest = buyable.length ? buyable.reduce((min, variant) => (variant.price.amount < min.price.amount ? variant : min)) : null;
  const price = lowest ? lowest.price : product.price;
  const inStock = product.availableForSale && buyable.length > 0;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${SITE_URL}/products/${product.slug}#product`,
    name: product.name,
    description: product.shortDescription,
    ...(lowest ? { sku: lowest.sku } : {}),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    image: product.images.slice(0, 4).map((image) => image.url),
    /*
     * `aggregateRating` is only emitted when there are real published reviews.
     * The previous `Math.max(reviews.length, 1)` meant a product with zero
     * reviews published a rating schema claiming a review count of 1 — a false
     * structured-data claim to search engines. Absence is the correct encoding
     * for "no reviews yet".
     */
    ...(rating != null && reviews.length > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: rating,
            reviewCount: reviews.length,
          },
        }
      : {}),
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/products/${product.slug}`,
      priceCurrency: price.currency,
      price: price.amount.toFixed(2),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}

export function faqLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/**
 * Article structured data.
 *
 * `publisherName` is supplied by the caller from `StoreSettings` rather than
 * hardcoded, so the JSON-LD keeps the current brand when the admin renames the
 * business.
 */
export function articleLd(
  title: string,
  description: string,
  image: string | null,
  publishedAt: string,
  author: string,
  publisherName: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    ...(image ? { image } : {}),
    datePublished: publishedAt,
    author: { '@type': 'Person', name: author },
    publisher: { '@type': 'Organization', name: publisherName },
    mainEntityOfPage: { '@type': 'WebPage' },
  };
}

export function itemListLd(name: string, items: { name: string; href: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: `${SITE_URL}${item.href}`,
    })),
  };
}

/** Convenience for the single most common case: an array of graphs. */
export type JsonLdNode = Record<string, unknown>;

export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  // `<` is escaped so a string value can never terminate the script element.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
