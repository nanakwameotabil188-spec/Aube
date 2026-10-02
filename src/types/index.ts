/**
 * Domain contracts.
 *
 * Every shape here mirrors a future database table. UI components never
 * invent fields; they only consume what these interfaces declare. When the
 * backend lands, the API returns these types verbatim.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export type ID = string;
export type CurrencyCode = 'USD' | 'EUR' | 'GBP';

/** Money is always a minor-unit integer (pence/cents) to avoid float drift. */
export interface Money {
  amount: number;
  currency: CurrencyCode;
}

/**
 * Images are data, never raw strings in components.
 * The admin panel can upload, reorder, replace and remove these.
 */
export interface Image {
  id: ID;
  url: string;
  alt: string;
  position: number;
  isPrimary: boolean;
  width?: number;
  height?: number;
  /** Optional art direction handled by the image CDN. */
  blurDataUrl?: string;
}

export interface SeoMeta {
  title: string;
  description: string;
  canonicalPath?: string;
  noIndex?: boolean;
  ogImage?: Image;
}

export type PublishStatus = 'active' | 'draft' | 'archived';

/**
 * Fields shared by every sortable, admin-manageable entity.
 * `position` is the single ordering contract across the whole platform.
 */
export interface Orderable {
  /** Admin-controlled display order. Lower renders first. Never hardcoded. */
  position: number;
  status: PublishStatus;
  visible: boolean;
  seo?: SeoMeta;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Taxonomy                                                            */
/* ------------------------------------------------------------------ */

export interface TaxonomyTerm extends Orderable {
  id: ID;
  slug: string;
  name: string;
  shortDescription: string;
  description?: string;
  image?: Image;
  icon?: IconName;
  /** Optional tint used by category/concern tiles. Token name, not a hex. */
  tone?: 'sand' | 'moss' | 'clay' | 'blush' | 'oat' | 'shell';
}

export type Category = TaxonomyTerm & {
  parentId: ID | null;
  productType: ProductType;
  seoTitle?: string;
};

export type Collection = TaxonomyTerm & {
  /** Curated sets — the merchandising layer above categories. */
  rule: 'manual' | 'auto';
  productIds?: ID[];
  featuredProductId?: ID;
  story?: string;
};

export type Ingredient = TaxonomyTerm & {
  aka: string[];
  concentration?: string;
  origin?: string;
  benefits: string[];
  /** Products that centre this ingredient get highlighted on its page. */
  heroProductId?: ID;
};

export type SkinType = TaxonomyTerm;
export type SkinConcern = TaxonomyTerm & {
  /** Short reassurance line used under concern headings. */
  promise: string;
};

export type ProductType =
  | 'cleanser'
  | 'essence'
  | 'serum'
  | 'moisturiser'
  | 'eye'
  | 'mask'
  | 'oil'
  | 'sunscreen'
  | 'tool';

/* ------------------------------------------------------------------ */
/* Product                                                             */
/* ------------------------------------------------------------------ */

export interface ProductVariant {
  id: ID;
  sku: string;
  /** e.g. "50 ml", "Travel 15 ml" */
  name: string;
  size: string;
  price: Money;
  compareAtPrice?: Money;
  stockQuantity: number;
  position: number;
  isDefault: boolean;
  imageId?: ID;
}

export type BadgeTone = 'neutral' | 'moss' | 'clay' | 'danger' | 'ink';

export interface ProductBadge {
  id: ID;
  label: string;
  tone: BadgeTone;
  position: number;
}

/**
 * Aggregate rating, derived from approved reviews.
 *
 * `average` is `null` when there are no approved reviews. A zero would be a
 * claim that customers rated the product badly, and an invented 4.8 is a claim
 * they rated it well; only the absence is honest. Everything that renders a
 * rating must branch on this rather than coercing to a number.
 */
export interface RatingSummary {
  average: number | null;
  count: number;
  /** Star histogram, index 0 = 1 star … index 4 = 5 stars. */
  distribution: [number, number, number, number, number];
}

export interface Review {
  id: ID;
  productId: ID;
  author: string;
  verified: boolean;
  rating: number;
  title: string;
  body: string;
  skinType?: ID;
  skinConcerns?: ID[];
  helpfulCount: number;
  createdAt: string;
  /** Verified-buyer photo supplied by the customer. */
  images?: Image[];
}

export interface Product extends Orderable {
  id: ID;
  slug: string;
  name: string;
  /** Editorial subtitle, e.g. "Barrier-repair ceramide cream". */
  subtitle: string;
  brand: string;
  shortDescription: string;
  description: string;
  /** Ingredient-led "what it is" copy shown above the fold. */
  highlights: string[];

  price: Money;
  compareAtPrice?: Money;
  currency: CurrencyCode;

  images: Image[];
  thumbnail: Image;

  categoryId: ID;
  productType: ProductType;
  collectionIds: ID[];
  skinTypeIds: ID[];
  skinConcernIds: ID[];
  ingredientIds: ID[];
  heroIngredientIds: ID[];

  benefits: string[];
  usage: string[];
  ingredients: string;
  keyIngredients: { ingredientId: ID; note: string }[];
  warnings?: string[];

  size: string;
  variants: ProductVariant[];

  stockQuantity: number;
  availableForSale: boolean;
  lowStockThreshold: number;
  /** Free-text lead time shown before dispatch. */
  dispatchEstimate?: string;

  rating: RatingSummary;
  badges: ProductBadge[];

  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;

  /** Manual merchandising link; a recommendation service can replace it. */
  relatedProductIds: ID[];
  /** Bought-together bundle, curated by merchandising. */
  frequentlyBoughtWithIds: ID[];

  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

export type IconName =
  | 'leaf'
  | 'droplet'
  | 'sun'
  | 'sparkle'
  | 'shield'
  | 'flask'
  | 'heart'
  | 'moon'
  | 'wind'
  | 'gift'
  | 'package'
  | 'truck'
  | 'refresh';

export interface NavLink {
  id: ID;
  label: string;
  href: string;
  position: number;
  visible: boolean;
  children?: NavLink[];
  /** Mega-menu feature panel rendered alongside children. */
  feature?: { title: string; href: string; image?: Image; eyebrow?: string };
}

export interface Announcement {
  id: ID;
  message: string;
  href?: string;
  position: number;
  visible: boolean;
}

export interface FooterColumn {
  id: ID;
  heading: string;
  position: number;
  links: { id: ID; label: string; href: string; position: number }[];
}

/**
 * First-visit onboarding slide.
 *
 * The introduction a new visitor sees once. Fully admin-controlled: slides are
 * created, edited, reordered, hidden, and the sequence as a whole is switched
 * on and off, without a deploy. The wording in the seed data is a starting
 * point, not a fixed script.
 */
export interface OnboardingSlide {
  id: ID;
  /** Small label above the title. Optional. */
  eyebrow?: string;
  title: string;
  body: string;
  image?: Image;
  /** Optional call to action. Both parts are editable. */
  ctaLabel?: string;
  ctaHref?: string;
  /** Icon for slides that carry no image. */
  icon?: IconName;
  position: number;
  enabled: boolean;
}

export interface Testimonial {
  id: ID;
  author: string;
  location: string;
  rating: number;
  quote: string;
  productId?: ID;
  skinConcernIds?: ID[];
  verified: boolean;
  position: number;
  visible: boolean;
}

export interface FaqItem {
  id: ID;
  question: string;
  answer: string;
  group: 'orders' | 'products' | 'shipping' | 'skin' | 'subscriptions';
  position: number;
  visible: boolean;
}

export interface JournalSection {
  id: ID;
  heading?: string;
  body: string;
  image?: Image;
  list?: string[];
  pullQuote?: string;
}

/** Long-form marketing/support page rendered by the generic page template. */
export interface ContentPage {
  slug: string;
  eyebrow: string;
  title: string;
  intro: string;
  heroImage?: Image;
  sections: {
    id: string;
    heading: string;
    body: string[];
    list?: string[];
  }[];
  seo: SeoMeta;
}

export interface JournalPost extends Orderable {
  id: ID;
  slug: string;
  title: string;
  excerpt: string;
  category: 'skin-school' | 'ritual' | 'ingredient' | 'journal';
  author: string;
  readingTimeMinutes: number;
  publishedAt: string;
  image: Image;
  tags: string[];
  featured: boolean;
  /** Products the article actually discusses; rendered as a cited list. */
  productIds: ID[];
  body: JournalSection[];
}

export interface Promotion {
  id: ID;
  name: string;
  code?: string;
  description: string;
  type: 'percentage' | 'fixed' | 'free_shipping';
  value?: number;
  appliesTo: { categoryIds?: ID[]; collectionIds?: ID[]; productIds?: ID[] };
  position: number;
  visible: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface ShippingMethod {
  id: ID;
  name: string;
  description: string;
  price: Money;
  freeAbove?: Money;
  estimate: string;
  position: number;
  visible: boolean;
}

/* ------------------------------------------------------------------ */
/* Home page composition — fully admin-ordered                        */
/* ------------------------------------------------------------------ */

export interface SectionBase {
  id: ID;
  /** Renderer key. The admin panel selects from a registered type list. */
  type: string;
  position: number;
  enabled: boolean;
  /** Optional per-section background treatment. */
  theme?: 'default' | 'sand' | 'moss' | 'ink' | 'oat';
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  cta?: LinkCta;
  image?: Image;
  secondaryImage?: Image;
}

export interface LinkCta {
  label: string;
  href: string;
  style?: 'primary' | 'secondary' | 'text';
}

export interface ProductRailSection extends SectionBase {
  type: 'product-rail';
  source:
    | { kind: 'handpicked'; productIds: ID[] }
    | { kind: 'flagship'; flag: 'featured' | 'bestSeller' | 'newArrival'; limit?: number };
  columns?: 2 | 3 | 4;
}

export interface CategoryTilesSection extends SectionBase {
  type: 'category-tiles';
  source: { kind: 'handpicked'; termIds: ID[] } | { kind: 'all'; limit?: number };
  variant: 'image' | 'minimal';
}

/**
 * One row per category, each showing that category's own products.
 *
 * This is the section that makes categories real structured data rather than a
 * label on a product: nothing here names a category, and the rows are built
 * from whatever categories the admin selects and whatever products currently
 * carry them. Adding a "Cleansers" category with three products makes a
 * Cleansers row appear; it is not a hard-coded section that has to be written
 * by a developer.
 *
 * Categories are chosen explicitly rather than discovered, because a shop with
 * a dozen categories would otherwise get a dozen rows and an unusable homepage.
 * Order is the admin's, so the most important category can lead.
 */
export interface CategoryShowcaseSection extends SectionBase {
  type: 'category-showcase';
  categoryIds: ID[];
  /** How many products to show per row. Categories with fewer show all of them. */
  perCategory?: number;
  /** How many category rows to render. Extra selections are dropped. */
  maxCategories?: number;
}

export interface ConcernTilesSection extends SectionBase {
  type: 'concern-tiles';
  concernIds: ID[];
  layout: 'row' | 'tiles';
}

export interface IngredientStripSection extends SectionBase {
  type: 'ingredient-strip';
  ingredientIds: ID[];
}

export interface HeroSection extends SectionBase {
  type: 'hero';
  layout: 'split' | 'full-bleed' | 'centered';
  secondaryCta?: LinkCta;
  secondaryImage?: Image;
  overlay?: 'none' | 'soft' | 'strong';
  /**
   * Short figures under the hero copy. Data, not markup, so the business can
   * change or remove them without a deploy — and so no statistic can be
   * introduced by editing a component.
   */
  stats?: { value: string; label: string }[];
}

export interface EditorialSplitSection extends SectionBase {
  type: 'editorial-split';
  imagePosition: 'left' | 'right';
  body: string;
  points?: { id: ID; title: string; body: string }[];
}

export interface ValueStripSection extends SectionBase {
  type: 'value-strip';
  /** Optional inline items; when omitted the store-level values are used. */
  items?: { id: ID; icon: IconName; title: string; body: string }[];
}

export interface TestimonialSection extends SectionBase {
  type: 'testimonials';
  testimonialIds: ID[];
}

export interface JournalSectionType extends SectionBase {
  type: 'journal';
  postIds: ID[];
  columns?: 2 | 3;
}

export interface FaqSection extends SectionBase {
  type: 'faq';
  faqIds: ID[];
}

export interface NewsletterSection extends SectionBase {
  type: 'newsletter';
  incentive: string;
  consentCopy: string;
}

export interface RoutineSection extends SectionBase {
  type: 'routine';
  steps: { id: ID; step: number; title: string; body: string; productIds: ID[] }[];
}

export interface PromoBannerSection extends SectionBase {
  type: 'promo-banner';
  promotionId: ID;
  variant: 'full' | 'split' | 'slim';
}

export interface CollectionFeatureSection extends SectionBase {
  type: 'collection-feature';
  collectionId: ID;
  layout: 'full' | 'split';
}

export type HomeSection =
  | HeroSection
  | ProductRailSection
  | CollectionFeatureSection
  | CategoryTilesSection
  | CategoryShowcaseSection
  | ConcernTilesSection
  | IngredientStripSection
  | EditorialSplitSection
  | ValueStripSection
  | TestimonialSection
  | JournalSectionType
  | FaqSection
  | RoutineSection
  | PromoBannerSection
  | NewsletterSection;

/* ------------------------------------------------------------------ */
/* Store configuration                                                 */
/* ------------------------------------------------------------------ */

/**
 * Global brand settings.
 *
 * The single source of truth for anything the business owner is allowed to
 * change without a deploy. Every component that needs the brand name, a logo,
 * contact detail, or default SEO copy reads it from here, so renaming the
 * business propagates to the navbar, footer, metadata, structured data, order
 * numbers, SKUs, and admin chrome in one edit.
 *
 * Long-form editorial body copy (about page, FAQ answers, policy text) is
 * deliberately *not* here — that is page content the admin edits directly in
 * the CMS, not a global.
 */
export interface StoreSettings {
  brandName: string;
  legalName: string;
  tagline: string;
  description: string;
  currency: CurrencyCode;
  locale: string;
  supportEmail: string;
  supportPhone: string;
  /** Order threshold above which shipping is free. */
  freeShippingThreshold: Money;
  defaultShippingMethodId: ID;
  taxNote: string;
  social: { id: ID; label: string; href: string; position: number }[];
  payments: { id: ID; label: string; position: number; enabled: boolean }[];
  countries: string[];

  /* ---- Admin-editable brand identity ---- */

  /** Short uppercase prefix for order numbers and SKUs, e.g. `AUBE`. */
  brandCode: string;
  /** Registered or trading address, shown in the footer. */
  address: string;
  /**
   * Logo. When absent the header and footer fall back to a text wordmark, so
   * the site is never broken by a missing upload.
   */
  logo: Image | null;
  logoAlt: string;
  favicon: Image | null;
  /** Default social sharing image. */
  shareImage: Image | null;

  /* ---- Admin-editable SEO defaults ---- */

  seoTitle: string;
  seoDescription: string;
}

/* ------------------------------------------------------------------ */
/* Commerce state                                                      */
/* ------------------------------------------------------------------ */

export interface CartLine {
  id: ID;
  productId: ID;
  variantId: ID;
  slug: string;
  name: string;
  subtitle: string;
  size: string;
  /** Denormalised for display; the server re-prices on every mutation. */
  unitPrice: Money;
  compareAtUnitPrice?: Money;
  quantity: number;
  maxQuantity: number;
  image: Image;
  /** Set when the line could not be fulfilled at add time. */
  unavailableReason?: string;
  addedAt: string;
}

export interface AppliedDiscount {
  id: ID;
  code: string;
  label: string;
  type: 'percentage' | 'fixed' | 'free_shipping';
  value: number;
  amount: Money;
}

export interface CartTotals {
  subtotal: Money;
  discountTotal: Money;
  shipping: Money;
  tax: Money;
  total: Money;
  /** Progress toward free shipping, 0–1. Drives the free-shipping meter. */
  freeShippingProgress: number;
  freeShippingThreshold: Money;
}

export interface Cart {
  id: ID;
  lines: CartLine[];
  discounts: AppliedDiscount[];
  totals: CartTotals;
  currency: CurrencyCode;
  updatedAt: string;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface Address {
  id: ID;
  label: string;
  firstName: string;
  lastName: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface Customer {
  id: ID;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  addresses: Address[];
  marketingOptIn: boolean;
  createdAt: string;
}

export interface OrderLine {
  id: ID;
  productId: ID;
  variantId: ID;
  name: string;
  size: string;
  slug: string;
  quantity: number;
  unitPrice: Money;
  image: Image;
}

export interface Order {
  id: ID;
  number: string;
  status: OrderStatus;
  customerEmail: string;
  customerName: string;
  lines: OrderLine[];
  discounts: AppliedDiscount[];
  shippingAddress: Address;
  billingAddress: Address;
  shippingMethodId: ID;
  shippingMethodName: string;
  totals: CartTotals;
  paymentMethodLabel: string;
  /** Last four only — full PAN never reaches the storefront. */
  paymentLast4?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  placedAt: string;
  updatedAt: string;
  timeline: { id: ID; label: string; at: string; completed: boolean }[];
}

/* ------------------------------------------------------------------ */
/* Query contracts for the future API                                  */
/* ------------------------------------------------------------------ */

export type ProductSortKey =
  | 'position'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'rating';

export interface ProductQuery {
  search?: string;
  categoryIds?: ID[];
  collectionIds?: ID[];
  skinTypeIds?: ID[];
  skinConcernIds?: ID[];
  ingredientIds?: ID[];
  productTypes?: ProductType[];
  brands?: ID[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  flags?: { featured?: boolean; bestSeller?: boolean; newArrival?: boolean };
  sort?: ProductSortKey;
  page?: number;
  perPage?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * Service result.
 *
 * Discriminated union rather than an optional `error` field: a failure must not
 * be able to carry a placeholder `data` value, otherwise every caller that
 * reads `result.data` without checking gets a truthy-but-wrong object and
 * fails deep in rendering instead of at the service boundary.
 */
export type Result<T> =
  | { data: T; error?: undefined }
  | { data?: undefined; error: ServiceError };

export type ServiceErrorCode =
  | 'network'
  | 'not_found'
  | 'validation'
  | 'unauthorized'
  | 'unknown';

export interface ServiceError {
  code: ServiceErrorCode;
  message: string;
  /** Underlying cause, shown to developers, never to customers. */
  detail?: string;
}

/* ------------------------------------------------------------------ */
/* Icon registry (kept in sync with <Icon />)                          */
/* ------------------------------------------------------------------ */

export const ICON_NAMES = [
  'cart',
  'heart',
  'search',
  'user',
  'menu',
  'close',
  'chevron-down',
  'chevron-right',
  'chevron-left',
  'arrow-right',
  'arrow-left',
  'plus',
  'minus',
  'check',
  'star',
  'filter',
  'truck',
  'leaf',
  'droplet',
  'sun',
  'sparkle',
  'shield',
  'flask',
  'moon',
  'wind',
  'trash',
  'refresh',
  'grid',
  'rows',
  'info',
  'lock',
  'package',
  'gift',
  'bell',
  'instagram',
] as const;

export type IconGlyph = (typeof ICON_NAMES)[number];
