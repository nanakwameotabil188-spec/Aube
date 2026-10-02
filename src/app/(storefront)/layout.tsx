import type { Metadata } from 'next';
import { contentService } from '@/lib/services/content-service';
import { productService, categoryService, skinConcernService, ingredientService } from '@/lib/services/catalog-service';
import { StorefrontProviders } from '@/components/providers/StorefrontProviders';
import { StorefrontShell } from '@/components/layout/StorefrontShell';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aube.com';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await contentService.getSettings();

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${settings.brandName} — ${settings.tagline}`,
      template: `%s | ${settings.brandName}`,
    },
    description: settings.description,
    applicationName: settings.brandName,
    authors: [{ name: settings.legalName }],
    openGraph: {
      type: 'website',
      siteName: settings.brandName,
      title: `${settings.brandName} — ${settings.tagline}`,
      description: settings.description,
      url: SITE_URL,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${settings.brandName} — ${settings.tagline}`,
      description: settings.description,
    },
    robots: { index: true, follow: true },
    alternates: { canonical: '/' },
    formatDetection: { telephone: false },
  };
}

/**
 * Storefront layout.
 *
 * Everything the shopper shell needs is resolved once, on the server, and
 * passed down as serialisable data. No client-side bootstrap fetch. Routes
 * outside this group — the admin panel — render without any of it.
 */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [settings, nav, announcements, categories, skinConcerns, ingredients, columns, valueProps, shippingMethods, cartRecommendations, slides] =
    await Promise.all([
      contentService.getSettings(),
      contentService.getPrimaryNav(),
      contentService.getAnnouncements(),
      categoryService.getAll(),
      skinConcernService.getAll(),
      ingredientService.getAll(),
      contentService.getFooterColumns(),
      contentService.getValueProps(),
      contentService.getShippingMethods(),
      productService.getByFlags('isBestSeller', 3),
      contentService.getOnboardingSlides(),
    ]);

  return (
    <StorefrontProviders settings={settings} shippingMethods={shippingMethods}>
      <StorefrontShell
        settings={settings}
        nav={nav}
        announcements={announcements}
        categories={categories}
        skinConcerns={skinConcerns}
        ingredients={ingredients}
        columns={columns}
        valueProps={valueProps}
        cartRecommendations={cartRecommendations}
        onboardingSlides={slides}
      >
        {children}
      </StorefrontShell>
    </StorefrontProviders>
  );
}
