import type {
  Announcement,
  AppliedDiscount,
  CartLine,
  CartTotals,
  Category,
  Collection,
  ConcernTilesSection,
  ContentPage,
  Customer,
  FaqItem,
  FooterColumn,
  HomeSection,
  ID,
  Ingredient,
  IngredientStripSection,
  JournalPost,
  NavLink,
  Order,
  Product,
  ProductRailSection,
  Promotion,
  RoutineSection,
  ShippingMethod,
  StoreSettings,
  OnboardingSlide,
  Testimonial,
} from '@/types';
import { homeSections } from '@/data/home';
import { onboardingSlides } from '@/data/onboarding';
import { aboutPage, contactPage, faqItems, journalPosts, policies, testimonials } from '@/data/content';
import {
  announcements,
  footerColumns,
  promotions,
  shippingMethods,
  storeSettings,
  valueProps,
} from '@/data/settings';
import { accountNav, primaryNav, utilityNav } from '@/data/navigation';
import {
  categoryService,
  collectionService,
  ingredientService,
  productService,
  skinConcernService,
} from './catalog-service';
import { contentOverlay } from './repositories';
import { byPosition, byPositionField, filterVisible } from '@/lib/utils/ordering';

/**
 * Content service.
 *
 * Home page composition, navigation, editorial content and store settings all
 * arrive through here. No component in `src/components` imports from `@/data`.
 */

const FLAG_TO_FIELD = {
  featured: 'isFeatured',
  bestSeller: 'isBestSeller',
  newArrival: 'isNewArrival',
} as const;

export const contentService = {
  /* ---------------- Home composition ---------------- */

  /**
   * Enabled sections in admin-controlled order.
   *
   * Read from the database when a record exists. The in-repo definitions remain
   * the fallback and the starting point, but the admin's ordering, visibility,
   * and copy are what the storefront has to render — otherwise the Homepage
   * screen was a control panel for a page nobody saw.
   */
  async getHomeSections(): Promise<HomeSection[]> {
    const stored = await (await contentOverlay())?.readHomeSections();
    const source = stored ?? homeSections;
    return source.filter((section) => section.enabled).sort(byPosition);
  },
  /**
   * Resolves a section plus its referenced records into a render-ready
   * payload. The renderer component stays purely presentational, and a CMS
   * payload can be hydrated through exactly the same path.
   */
  async resolveSection(section: HomeSection): Promise<ResolvedSection> {
    switch (section.type) {
      case 'product-rail': {
        const products = await resolveRail(section);
        return { type: 'product-rail', section, products };
      }
      case 'collection-feature': {
        const collection = await collectionService.getById(section.collectionId);
        const products = collection ? await productService.getByCollection(collection.id) : [];
        return { type: 'collection-feature', section, collection, products };
      }
      case 'category-tiles': {
        const all = await categoryService.getAll();
        const terms =
          section.source.kind === 'all' ? all.slice(0, section.source.limit) : await categoryService.getManyByIds(section.source.termIds);
        return { type: 'category-tiles', section, terms };
      }
      case 'category-showcase': {
        // One row per selected category, in the admin's order, each holding that
        // category's own visible products. Empty categories are dropped rather
        // than rendered as a heading with nothing under it.
        //
        // Queried per category rather than by loading the whole catalogue and
        // grouping it here: the section shows at most `maxCategories` rows, so
        // this is a handful of bounded queries instead of a full-table read on
        // every homepage render.
        const terms = await categoryService.getManyByIds(section.categoryIds);
        const perCategory = section.perCategory ?? 4;
        const maxCategories = section.maxCategories ?? 4;

        // `getManyByIds` returns catalogue order filtered by membership, not the
        // order they were asked for — so the admin's chosen order is re-applied
        // here. Without this the rows would silently reorder themselves the first
        // time a category was renamed, which is exactly the sort of drift an
        // admin is right to assume is their own doing.
        const byId = new Map(terms.map((term) => [term.id, term]));
        const ordered = section.categoryIds
          .map((id) => byId.get(id))
          .filter((term): term is Category => Boolean(term));

        const resolved = await Promise.all(
          ordered.map(async (category) => ({
            category,
            products: (await productService.getByCategory(category.id)).slice(0, perCategory),
          })),
        );

        const groups = resolved.filter((group) => group.products.length > 0).slice(0, maxCategories);

        return { type: 'category-showcase', section, groups };
      }
      case 'concern-tiles': {
        const concerns = await skinConcernService.getWithCounts();
        const wanted = new Set(section.concernIds);
        return { type: 'concern-tiles', section, concerns: concerns.filter((item) => wanted.has(item.id)) };
      }
      case 'ingredient-strip': {
        const ingredients = await ingredientService.getManyByIds(section.ingredientIds);
        return { type: 'ingredient-strip', section, ingredients };
      }
      case 'value-strip':
        return { type: 'value-strip', section, items: valueProps };
      case 'testimonials': {
        const items = await this.getTestimonials(section.testimonialIds);
        return { type: 'testimonials', section, items: await attachTestimonialProducts(items) };
      }
      case 'journal': {
        const all = await this.getJournalPosts();
        const wanted = new Set(section.postIds);
        const selected = all.filter((item) => wanted.has(item.id));
        return { type: 'journal', section, posts: selected.length ? selected : all.slice(0, section.columns === 2 ? 2 : 3) };
      }
      case 'faq':
        return { type: 'faq', section, items: await this.getFaqByIds(section.faqIds) };
      case 'routine': {
        const steps = await Promise.all(
          section.steps.map(async (step) => ({
            ...step,
            products: await productService.getInOrder(step.productIds),
          })),
        );
        return { type: 'routine', section, steps };
      }
      case 'promo-banner': {
        const promotion = (await this.getPromotions()).find((item) => item.id === section.promotionId) ?? null;
        return { type: 'promo-banner', section, promotion };
      }
      case 'hero':
        return { type: 'hero', section };
      case 'editorial-split':
        return { type: 'editorial-split', section };
      case 'newsletter':
        return { type: 'newsletter', section };
    }
  },

  /** Resolve the whole page in order — what the homepage route consumes. */
  async getResolvedHomeSections(): Promise<ResolvedSection[]> {
    const sections = await this.getHomeSections();
    return Promise.all(sections.map((section) => this.resolveSection(section)));
  },

  /* ---------------- Store configuration ---------------- */

  async getSettings(): Promise<StoreSettings> {
    // The database record overrides the in-repo defaults when one exists. This is
    // the read that makes the admin's Branding screen real: without it the form
    // saved to a table nothing ever looked at, and the site name could not be
    // changed without a deploy.
    return (await (await contentOverlay())?.readStoreSettings()) ?? storeSettings;
  },

  async getAnnouncements(): Promise<Announcement[]> {
    const stored = await (await contentOverlay())?.readAnnouncements();
    const source = stored ?? announcements;
    return byPositionField(source).filter((item) => item.visible);
  },

  async getFooterColumns(): Promise<FooterColumn[]> {
    const stored = await (await contentOverlay())?.readFooterColumns();
    return (stored ?? footerColumns).slice().sort((a, b) => a.position - b.position);
  },

  async getValueProps() {
    // No admin surface and no stored record for these yet, so the in-repo
    // definitions are the whole truth rather than a fallback.
    return valueProps;
  },

  async getShippingMethods(): Promise<ShippingMethod[]> {
    const stored = await (await contentOverlay())?.readShippingMethods();
    return (stored ?? shippingMethods)
      .filter((item) => item.visible)
      .sort((a, b) => a.position - b.position);
  },

  async getShippingMethod(id: string): Promise<ShippingMethod | null> {
    const stored = await (await contentOverlay())?.readShippingMethods();
    return (stored ?? shippingMethods).find((item) => item.id === id && item.visible) ?? null;
  },

  async getPromotions(): Promise<Promotion[]> {
    const stored = await (await contentOverlay())?.readPromotions();
    return byPositionField(stored ?? promotions).filter((item) => item.visible);
  },

  async getPromotionByCode(code: string): Promise<Promotion | null> {
    const stored = await (await contentOverlay())?.readPromotions();
    return (stored ?? promotions).find(
      (item) => item.code?.toLowerCase() === code.trim().toLowerCase() && item.visible,
    ) ?? null;
  },

  /* ---------------- Navigation ---------------- */

  async getPrimaryNav(): Promise<NavLink[]> {
    return byPositionField(primaryNav).filter((item) => item.visible);
  },

  async getUtilityNav(): Promise<NavLink[]> {
    return byPositionField(utilityNav).filter((item) => item.visible);
  },

  async getAccountNav(): Promise<NavLink[]> {
    return byPositionField(accountNav).filter((item) => item.visible);
  },

  /* ---------------- Editorial ---------------- */

  /**
   * First-visit onboarding slides, in admin-defined order.
   *
   * Returns the enabled slides only. When every slide is disabled or deleted
   * this is an empty array and the storefront renders no dialog at all, rather
   * than an empty shell.
   */
  async getOnboardingSlides(): Promise<OnboardingSlide[]> {
    const stored = await (await contentOverlay())?.readOnboardingSlides();
    return (stored ?? onboardingSlides)
      .filter((slide) => slide.enabled)
      .sort((a, b) => a.position - b.position);
  },

  async getTestimonials(ids?: string[]): Promise<Testimonial[]> {
    if (!ids) return byPositionField(filterVisible(testimonials));
    const wanted = new Set(ids);
    return byPositionField(testimonials.filter((item) => wanted.has(item.id)));
  },

  async getFaqItems(group?: FaqItem['group']): Promise<FaqItem[]> {
    const visible = byPositionField(filterVisible(faqItems));
    return group ? visible.filter((item) => item.group === group) : visible;
  },

  async getFaqByIds(ids: string[]): Promise<FaqItem[]> {
    const wanted = new Set(ids);
    return byPositionField(faqItems.filter((item) => wanted.has(item.id)));
  },

  async getJournalPosts(limit?: number): Promise<JournalPost[]> {
    const posts = journalPosts.filter((item) => item.visible && item.status === 'active').sort(byPosition);
    return limit ? posts.slice(0, limit) : posts;
  },

  async getJournalPost(slug: string): Promise<JournalPost | null> {
    return journalPosts.find((item) => item.slug === slug && item.visible) ?? null;
  },

  async getPage(slug: string): Promise<ContentPage | null> {
    if (slug === aboutPage.slug) return aboutPage;
    if (slug === contactPage.slug) return contactPage;
    return policies[slug as keyof typeof policies] ?? null;
  },

  /** Every static content page, for the sitemap and any page index. */
  async getPages(): Promise<ContentPage[]> {
    return [aboutPage, contactPage, ...Object.values(policies)];
  },
};

async function resolveRail(section: ProductRailSection): Promise<Product[]> {
  if (section.source.kind === 'flagship') {
    return productService.getByFlags(FLAG_TO_FIELD[section.source.flag], section.source.limit);
  }
  return productService.getInOrder(section.source.productIds);
}

/** A testimonial plus the product it refers to, so the card can link to it. */
export type ResolvedTestimonial = Testimonial & { product: { name: string; slug: string } | null };

async function attachTestimonialProducts(items: Testimonial[]): Promise<ResolvedTestimonial[]> {
  return Promise.all(
    items.map(async (item) => {
      const product = item.productId ? await productService.getById(item.productId) : null;
      return { ...item, product: product ? { name: product.name, slug: product.slug } : null };
    }),
  );
}

/** The section record for a given `type`. */
type SectionOf<T extends HomeSection['type']> = Extract<HomeSection, { type: T }>;

/**
 * Union of every payload a section renderer can receive.
 *
 * `type` is repeated at the top level on purpose: TypeScript narrows a union by
 * a *direct* discriminant, so a renderer switching on `entry.type` gets full
 * narrowing of the whole entry, including its payload fields. Switching on
 * `entry.section.type` would narrow only the nested record and leave every
 * payload access untyped.
 */
export type ResolvedSection =
  | { type: 'hero'; section: SectionOf<'hero'> }
  | { type: 'product-rail'; section: SectionOf<'product-rail'>; products: Product[] }
  | {
      type: 'collection-feature';
      section: SectionOf<'collection-feature'>;
      collection: Collection | null;
      products: Product[];
    }
  | { type: 'category-tiles'; section: SectionOf<'category-tiles'>; terms: Category[] }
  | {
      type: 'category-showcase';
      section: SectionOf<'category-showcase'>;
      groups: { category: Category; products: Product[] }[];
    }
  | { type: 'concern-tiles'; section: SectionOf<'concern-tiles'>; concerns: SkinConcernWithCount[] }
  | { type: 'ingredient-strip'; section: SectionOf<'ingredient-strip'>; ingredients: Ingredient[] }
  | { type: 'editorial-split'; section: SectionOf<'editorial-split'> }
  | { type: 'value-strip'; section: SectionOf<'value-strip'>; items: typeof valueProps }
  | { type: 'testimonials'; section: SectionOf<'testimonials'>; items: ResolvedTestimonial[] }
  | { type: 'journal'; section: SectionOf<'journal'>; posts: JournalPost[] }
  | { type: 'faq'; section: SectionOf<'faq'>; items: FaqItem[] }
  | {
      type: 'routine';
      section: SectionOf<'routine'>;
      steps: { id: string; step: number; title: string; body: string; products: Product[] }[];
    }
  | { type: 'promo-banner'; section: SectionOf<'promo-banner'>; promotion: Promotion | null }
  | { type: 'newsletter'; section: SectionOf<'newsletter'> };

type SkinConcernWithCount = Awaited<ReturnType<typeof skinConcernService.getWithCounts>>[number];

/* ------------------------------------------------------------------ */
/* Account service — the mocked authentication boundary                */
/* ------------------------------------------------------------------ */

export const accountService = {
  /**
   * Every method here is where a real auth provider (Auth.js, Clerk, or a
   * first-party API) will be substituted. The contract — async, null on
   * failure, never throwing into a component — is the part that matters.
   */
  async getCurrentCustomer(): Promise<Customer | null> {
    const { mockCustomer } = await import('@/data/account');
    return mockCustomer;
  },

  async getOrders(): Promise<Order[]> {
    const { mockOrders } = await import('@/data/account');
    return mockOrders;
  },

  async getOrderById(id: string): Promise<Order | null> {
    const { mockOrders } = await import('@/data/account');
    return mockOrders.find((order) => order.id === id || order.number === id) ?? null;
  },

  /**
   * Creates an order from checkout input.
   *
   * The mutation lives here, not in the checkout component, so replacing the
   * mock with a real `POST /orders` changes only this method. The order number
   * is derived from the sequence rather than randomised, which keeps
   * confirmation URLs reproducible in a mock but would be server-assigned in
   * production.
   */
  async createOrder(input: CreateOrderInput): Promise<Order> {
    const [{ mockOrders }, settings] = await Promise.all([
      import('@/data/account').then((module) => ({ mockOrders: module.mockOrders })),
      contentService.getSettings(),
    ]);
    const now = new Date().toISOString();
    const sequence = String(mockOrders.length + 10429).padStart(5, '0');
    // Order numbers carry the business's own prefix, so renaming the brand in
    // the admin renumbers orders too.
    const number = `${settings.brandCode}-${sequence}`;

    const order: Order = {
      id: `ord-${String(mockOrders.length + 1).padStart(4, '0')}`,
      number,
      status: 'pending',
      customerEmail: input.email,
      customerName: `${input.shippingAddress.firstName} ${input.shippingAddress.lastName}`.trim(),
      lines: input.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        variantId: line.variantId,
        name: line.name,
        size: line.size,
        slug: line.slug,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        image: line.image,
      })),
      discounts: input.discounts,
      shippingAddress: {
        id: `addr-${sequence}`,
        label: 'Delivery address',
        firstName: input.shippingAddress.firstName,
        lastName: input.shippingAddress.lastName,
        line1: input.shippingAddress.line1,
        line2: input.shippingAddress.line2,
        city: input.shippingAddress.city,
        postalCode: input.shippingAddress.postalCode,
        country: input.shippingAddress.country,
        phone: input.shippingAddress.phone,
        isDefaultShipping: true,
        isDefaultBilling: true,
      },
      billingAddress: {
        id: `addr-${sequence}`,
        label: 'Billing address',
        firstName: input.shippingAddress.firstName,
        lastName: input.shippingAddress.lastName,
        line1: input.shippingAddress.line1,
        line2: input.shippingAddress.line2,
        city: input.shippingAddress.city,
        postalCode: input.shippingAddress.postalCode,
        country: input.shippingAddress.country,
        isDefaultShipping: false,
        isDefaultBilling: true,
      },
      shippingMethodId: input.shippingMethodId,
      shippingMethodName: input.shippingMethodName,
      totals: input.totals,
      // Mirrors the database path: no gateway charges, so nothing is collected and
      // the mock must not say otherwise. `paymentLast4` is dropped for the same
      // reason — a retained PAN fragment implies a transaction that never
      // happened.
      paymentMethodLabel: 'Not collected',
      paymentLast4: undefined,
      placedAt: now,
      updatedAt: now,
      timeline: [
        { id: 'tl-1', label: 'Order received — awaiting payment', at: now, completed: true },
        { id: 'tl-2', label: 'Packed', at: now, completed: false },
        { id: 'tl-3', label: 'Shipped', at: now, completed: false },
        { id: 'tl-4', label: 'Delivered', at: now, completed: false },
      ],
    };

    mockOrders.unshift(order);
    return order;
  },

  /**
   * Throws on purpose. A real implementation delegates to the auth provider.
   * Keeping it explicit stops any UI from appearing to work against a system
   * that does not exist.
   */
  async signIn(): Promise<never> {
    throw new Error('Not implemented: delegate this to your authentication provider.');
  },
};

/** What checkout hands over; deliberately narrower than `Order`. */
export interface CreateOrderInput {
  email: string;
  shippingAddress: {
    firstName: string;
    lastName: string;
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shippingMethodId: ID;
  shippingMethodName: string;
  lines: CartLine[];
  discounts: AppliedDiscount[];
  totals: CartTotals;
  paymentLast4?: string;
}
