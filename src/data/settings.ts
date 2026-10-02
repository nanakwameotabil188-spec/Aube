import type { Announcement, FooterColumn, Promotion, ShippingMethod, StoreSettings } from '@/types';
import { money } from '@/lib/utils/format';

/**
 * Store configuration.
 *
 * Everything an operator would realistically change — brand strings,
 * thresholds, payment methods, social links, shipping rates, promotions —
 * lives here as data rather than in components.
 */

export const storeSettings: StoreSettings = {
  brandName: 'AUBE',
  legalName: 'AUBE Skin Ltd.',
  brandCode: 'AUBE',
  tagline: 'Clinical skincare, quietly considered.',
  description:
    'Formulated skincare built on published evidence, made in small batches, and sold at a price that does not require a discount code to justify.',
  currency: 'USD',
  locale: 'en-US',
  supportEmail: 'care@aube.com',
  supportPhone: '+1 (415) 555-0142',
  address: '',
  logo: null,
  logoAlt: 'AUBE',
  favicon: null,
  shareImage: null,
  seoTitle: 'AUBE — Clinical skincare, quietly considered.',
  seoDescription:
    'A short range of skincare built around published evidence, with every active and its concentration listed on the product page.',
  freeShippingThreshold: money(7500),
  defaultShippingMethodId: 'ship-standard',
  taxNote: 'Prices shown exclude local sales tax, calculated at checkout.',
  social: [
    { id: 'soc-1', label: 'Instagram', href: 'https://instagram.com', position: 1 },
    { id: 'soc-2', label: 'Pinterest', href: 'https://pinterest.com', position: 2 },
    { id: 'soc-3', label: 'TikTok', href: 'https://tiktok.com', position: 3 },
    { id: 'soc-4', label: 'YouTube', href: 'https://youtube.com', position: 4 },
  ],
  payments: [
    { id: 'pay-1', label: 'Card', position: 1, enabled: true },
    { id: 'pay-2', label: 'PayPal', position: 2, enabled: true },
    { id: 'pay-3', label: 'Apple Pay', position: 3, enabled: true },
    { id: 'pay-4', label: 'Google Pay', position: 4, enabled: true },
    { id: 'pay-5', label: 'Klarna — 4 payments', position: 5, enabled: true },
    { id: 'pay-6', label: 'Gift card', position: 6, enabled: true },
  ],
  countries: ['United States', 'United Kingdom', 'Canada', 'Ireland', 'Germany', 'France', 'Netherlands', 'Australia'],
};

/** Announcement bar messages rotate client-side; order is admin-controlled. */
export const announcements: Announcement[] = [
  {
    id: 'ann-1',
    message: 'Complimentary shipping on orders over $75',
    href: '/shop',
    position: 1,
    visible: true,
  },
  {
    id: 'ann-2',
    message: 'Free returns within 60 days, no questions asked',
    position: 2,
    visible: true,
  },
  {
    id: 'ann-3',
    message: 'Barrier Ritual now available as a discovery set',
    href: '/collection/the-barrier-ritual',
    position: 3,
    visible: true,
  },
];

export const footerColumns: FooterColumn[] = [
  {
    id: 'fc-shop',
    heading: 'Shop',
    position: 1,
    links: [
      { id: 'fc-shop-1', label: 'All products', href: '/shop', position: 1 },
      { id: 'fc-shop-2', label: 'Cleansers', href: '/category/cleansers', position: 2 },
      { id: 'fc-shop-3', label: 'Serums', href: '/category/serums', position: 3 },
      { id: 'fc-shop-4', label: 'Moisturisers', href: '/category/moisturisers', position: 4 },
      { id: 'fc-shop-5', label: 'Sun care', href: '/category/sun-care', position: 5 },
      { id: 'fc-shop-6', label: 'Sets & kits', href: '/category/sets', position: 6 },
    ],
  },
  {
    id: 'fc-skin',
    heading: 'Find your products',
    position: 2,
    links: [
      { id: 'fc-skin-1', label: 'Shop by concern', href: '/concern/dehydration', position: 1 },
      { id: 'fc-skin-2', label: 'Shop by skin type', href: '/skin-type/dry', position: 2 },
      { id: 'fc-skin-3', label: 'Ingredient library', href: '/ingredient/niacinamide', position: 3 },
      { id: 'fc-skin-4', label: 'The Essentials', href: '/collection/the-essentials', position: 4 },
      { id: 'fc-skin-5', label: 'Discovery sets', href: '/collection/discovery-sets', position: 5 },
    ],
  },
  {
    id: 'fc-help',
    heading: 'Help',
    position: 3,
    links: [
      { id: 'fc-help-1', label: 'Contact us', href: '/contact', position: 1 },
      { id: 'fc-help-2', label: 'Frequently asked questions', href: '/faq', position: 2 },
      { id: 'fc-help-3', label: 'Shipping & delivery', href: '/policies/shipping', position: 3 },
      { id: 'fc-help-4', label: 'Returns & refunds', href: '/policies/returns', position: 4 },
      { id: 'fc-help-5', label: 'Accessibility', href: '/policies/accessibility', position: 5 },
    ],
  },
  {
    id: 'fc-company',
    heading: 'AUBE',
    position: 4,
    links: [
      { id: 'fc-co-1', label: 'Our story', href: '/about', position: 1 },
      { id: 'fc-co-2', label: 'The journal', href: '/journal', position: 2 },
      { id: 'fc-co-3', label: 'Ingredients we will not use', href: '/about#standards', position: 3 },
      { id: 'fc-co-4', label: 'Privacy', href: '/policies/privacy', position: 4 },
      { id: 'fc-co-5', label: 'Terms', href: '/policies/terms', position: 5 },
    ],
  },
];

export const shippingMethods: ShippingMethod[] = [
  {
    id: 'ship-standard',
    name: 'Standard',
    description: 'Tracked delivery, carbon-neutral by default',
    price: money(500),
    freeAbove: money(7500),
    estimate: '3–5 working days',
    position: 1,
    visible: true,
  },
  {
    id: 'ship-express',
    name: 'Express',
    description: 'Priority handling, dispatched the same day if ordered before 2pm',
    price: money(1200),
    estimate: '1–2 working days',
    position: 2,
    visible: true,
  },
  {
    id: 'ship-overnight',
    name: 'Overnight',
    description: 'Order before 4pm weekdays for next-morning delivery',
    price: money(2400),
    estimate: 'Next working day',
    position: 3,
    visible: true,
  },
];

export const promotions: Promotion[] = [
  {
    id: 'promo-barrier-set',
    name: 'Barrier Ritual discovery set',
    code: 'BARRIER10',
    description: '10% off the Barrier Ritual discovery set',
    type: 'percentage',
    value: 10,
    appliesTo: { productIds: ['prod-barrier-discovery-set'] },
    position: 1,
    visible: true,
    startsAt: '2026-06-01T00:00:00.000Z',
    endsAt: '2026-12-31T23:59:59.000Z',
  },
  {
    id: 'promo-first-order',
    name: 'First order',
    code: 'WELCOME15',
    description: '15% off your first order over $60',
    type: 'percentage',
    value: 15,
    appliesTo: {},
    position: 2,
    visible: true,
    startsAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'promo-sun-care',
    name: 'Sun care bundle',
    code: 'SUNSHINE',
    description: 'Free express shipping on any sun care order',
    type: 'free_shipping',
    appliesTo: { categoryIds: ['cat-sun-care'] },
    position: 3,
    visible: true,
    startsAt: '2026-05-01T00:00:00.000Z',
    endsAt: '2026-10-31T23:59:59.000Z',
  },
  {
    id: 'promo-serum-stack',
    name: 'Serum stack',
    code: 'STACK20',
    description: '20% off when you buy two or more serums',
    type: 'percentage',
    value: 20,
    appliesTo: { categoryIds: ['cat-serums'] },
    position: 4,
    visible: true,
    startsAt: '2026-09-01T00:00:00.000Z',
    endsAt: '2026-11-30T23:59:59.000Z',
  },
];

/** Editorial, non-commercial trust signals shown in the footer. */
export const valueProps: { id: string; icon: 'leaf' | 'truck' | 'flask' | 'refresh'; title: string; body: string }[] = [
  {
    id: 'vp-1',
    icon: 'flask',
    title: 'Published evidence',
    body: 'Every active is listed with the concentration and the pH it works at, and every claim traces to a study we will name on request.',
  },
  {
    id: 'vp-2',
    icon: 'leaf',
    title: 'Formulated without',
    body: 'No fragrance, essential oils, silicones in the actives, drying alcohols, or anything we cannot justify on an ingredient list.',
  },
  {
    id: 'vp-3',
    icon: 'truck',
    title: 'Carbon-neutral delivery',
    body: 'Standard shipping is carbon-neutral by default and plastic-free. No minimum spend, no signature required.',
  },
  {
    id: 'vp-4',
    icon: 'refresh',
    title: 'Sixty-day returns',
    body: 'Sixty days to decide a product was wrong for your skin, opened or not. We pay the return label.',
  },
];
