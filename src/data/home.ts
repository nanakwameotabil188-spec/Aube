import type { HomeSection } from '@/types';
import { photo } from './media';

/**
 * Homepage composition.
 *
 * The homepage is a list of section records rendered by a registry
 * (`SectionRenderer`). Reordering, hiding, retitling or removing a section is a
 * data operation — no JSX changes and no code deploy — and the same records
 * are what the admin writes to `home_sections` in Supabase.
 *
 * ## Why this list is short
 *
 * The prototype shipped fourteen sections and read as a very long document. It
 * is now five: hero, featured products, shop by concern, one collection, and
 * the newsletter. The removed material was not deleted, it moved:
 *
 * - Journal / "Skin school"  → the `/journal` page, unchanged.
 * - Ingredient library       → the `/ingredients` page, and ingredient panels
 *                              on individual product pages.
 * - "Four things we will not
 *   compromise on"          → the first-visit onboarding sequence.
 * - Formulation standards    → the `/about` page.
 * - Testimonials             → removed, with no replacement. There are no real
 *                              customer statements, so there is nothing to
 *                              show until a moderation queue produces some.
 *
 * Sections may be reordered, disabled, or edited from the admin at any time.
 * `enabled: false` hides a section without deleting it, which is how a section
 * is retired without losing its content.
 */
export const homeSections: HomeSection[] = [
  {
    id: 'sec-hero',
    type: 'hero',
    position: 1,
    enabled: true,
    theme: 'default',
    layout: 'split',
    overlay: 'none',
    eyebrow: 'New — Autumn 2026',
    title: 'Skin that behaves,\nnot skin that performs',
    subtitle:
      'A short routine built from formulas that list every active and the concentration it is used at. Start with the essentials, then change what needs changing.',
    cta: { label: 'Shop the essentials', href: '/collection/the-essentials', style: 'primary' },
    secondaryCta: { label: 'Find your routine', href: '/concern/dehydration', style: 'text' },
    image: photo(8101532, 'Minimalist skincare display with natural light and soft shadows'),
    secondaryImage: photo(6568231, 'Close-up of clear, healthy skin'),
    /*
     * Figures are supplied as data, not baked into the renderer, so the business
     * controls them. They describe policy and formulation standards — not
     * clinical results, which are not stated anywhere on this site.
     */
    stats: [
      { value: '60 days', label: 'Returns, opened or not' },
      { value: 'SPD 50', label: 'Broad spectrum' },
      { value: '9', label: 'Ingredients, at most' },
    ],
  },
  {
    id: 'sec-featured',
    type: 'product-rail',
    position: 2,
    enabled: true,
    theme: 'default',
    eyebrow: 'Start here',
    title: 'Featured formulations',
    subtitle: 'The formulas we would build a routine around first.',
    cta: { label: 'Shop all products', href: '/shop', style: 'text' },
    source: { kind: 'flagship', flag: 'bestSeller', limit: 8 },
    columns: 4,
  },
  {
    id: 'sec-concerns',
    type: 'concern-tiles',
    position: 3,
    enabled: true,
    theme: 'sand',
    eyebrow: 'Start where you are',
    title: 'Shop by what your skin is doing',
    subtitle: 'Every concern has a mechanism behind it. Start with the mechanism, not the marketing.',
    layout: 'row',
    concernIds: [
      'sc-dehydration',
      'sc-dullness',
      'sc-breakouts',
      'sc-redness',
      'sc-dark-spots',
      'sc-fine-lines',
      'sc-barrier-damage',
      'sc-congestion',
    ],
  },
  {
    id: 'sec-essentials-feature',
    type: 'collection-feature',
    position: 4,
    enabled: true,
    theme: 'oat',
    layout: 'split',
    eyebrow: 'The short route',
    title: 'The Essentials',
    subtitle:
      'Four products, no actives to cycle, nothing you do not need. If you own nothing else, own these — and this is the routine we tell people to start from.',
    cta: { label: 'Explore the collection', href: '/collection/the-essentials', style: 'primary' },
    collectionId: 'col-essentials',
    image: photo(7691098, 'Elegant white skincare products arranged on a light background'),
  },
  {
    id: 'sec-newsletter',
    type: 'newsletter',
    position: 5,
    enabled: true,
    theme: 'ink',
    eyebrow: 'The list',
    title: 'Formulation notes, not discount codes',
    subtitle:
      'Roughly twice a month: what we are changing in a formula and why, with the evidence. No promotions, no launch spam, and you can leave in one click.',
    incentive: 'Subscribers get 15% off their first order with the code WELCOME15.',
    consentCopy:
      'By subscribing you agree to receive product and formulation emails. Unsubscribe at any time.',
  },
];
