import type { ReactNode } from 'react';
import type {
  Announcement,
  Category,
  FooterColumn,
  Ingredient,
  NavLink,
  OnboardingSlide,
  Product,
  SkinConcern,
  StoreSettings,
} from '@/types';
import type { IconName } from '@/components/ui/Icon';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { SearchOverlay } from './SearchOverlay';
import { OnboardingSequence } from '@/components/onboarding/OnboardingSequence';
import { footerConcernLinks, footerSkinTypeLinks } from '@/data/navigation';

/**
 * Storefront chrome.
 *
 * A server component: it renders the header, footer and overlays around
 * page children, all of which stay server-rendered. The interactive pieces
 * it composes are client components in their own right.
 */

export interface StorefrontShellProps {
  children: ReactNode;
  settings: StoreSettings;
  nav: NavLink[];
  announcements: Announcement[];
  categories: Category[];
  skinConcerns: SkinConcern[];
  ingredients: Ingredient[];
  columns: FooterColumn[];
  valueProps: { id: string; icon: IconName; title: string; body: string }[];
  cartRecommendations: Product[];
  /** First-visit slides. Empty means no dialog is rendered at all. */
  onboardingSlides: OnboardingSlide[];
}

export function StorefrontShell({
  children,
  settings,
  nav,
  announcements,
  categories,
  skinConcerns,
  ingredients,
  columns,
  valueProps,
  cartRecommendations,
  onboardingSlides,
}: StorefrontShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only-focusable">
        Skip to main content
      </a>

      <Header settings={settings} nav={nav} announcements={announcements} />

      <main id="main" className="flex-1">
        {children}
      </main>

      <Footer
        settings={settings}
        columns={columns}
        valueProps={valueProps}
        concernLinks={footerConcernLinks()}
        skinTypeLinks={footerSkinTypeLinks()}
      />

      <CartDrawer settings={settings} recommendations={cartRecommendations} />
      <SearchOverlay categories={categories} skinConcerns={skinConcerns} ingredients={ingredients} settings={settings} />
      <OnboardingSequence slides={onboardingSlides} />
    </div>
  );
}
