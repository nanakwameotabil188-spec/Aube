import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/structured-data';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Cart, checkout and account are per-visitor and have nothing
        // indexable on them; the mock account pages would otherwise surface in
        // results with placeholder data.
        disallow: ['/cart', '/checkout', '/account', '/search'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
