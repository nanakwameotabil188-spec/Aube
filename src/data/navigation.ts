import type { NavLink } from '@/types';
import { categories, collections, ingredients, skinConcerns, skinTypes } from './taxonomy';
import { photo } from './media';
import { byPositionField } from '@/lib/utils/ordering';

/**
 * Navigation model.
 *
 * The mega menu is composed from live taxonomy plus hand-curated groupings,
 * both ordered by `position`. An admin changing a category's position changes
 * the menu; a merchant can also add a standalone promotional link.
 */

/** Curated groupings, each of which is itself admin-orderable. */
const shopGroups: { id: string; heading: string; position: number; href: string; termIds: string[] }[] = [
  {
    id: 'grp-cleansers',
    heading: 'Cleanse',
    position: 1,
    href: '/category/cleansers',
    termIds: ['cat-cleansers'],
  },
  {
    id: 'grp-essences',
    heading: 'Prepare',
    position: 2,
    href: '/category/essences-toners',
    termIds: ['cat-essences'],
  },
  {
    id: 'grp-serums',
    heading: 'Treat',
    position: 3,
    href: '/category/serums',
    termIds: ['cat-serums'],
  },
  {
    id: 'grp-moisturisers',
    heading: 'Moisturise',
    position: 4,
    href: '/category/moisturisers',
    termIds: ['cat-moisturisers', 'cat-eye'],
  },
  {
    id: 'grp-treatments',
    heading: 'Treat weekly',
    position: 5,
    href: '/category/masks-treatments',
    termIds: ['cat-treatments'],
  },
  {
    id: 'grp-sun-care',
    heading: 'Protect',
    position: 6,
    href: '/category/sun-care',
    termIds: ['cat-sun-care'],
  },
  {
    id: 'grp-oils',
    heading: 'Seal',
    position: 7,
    href: '/category/face-oils',
    termIds: ['cat-oils'],
  },
  {
    id: 'grp-sets-tools',
    heading: 'Sets & tools',
    position: 8,
    href: '/category/sets',
    termIds: ['cat-sets', 'cat-tools'],
  },
];

const categoriesById = new Map(categories.map((category) => [category.id, category]));

function termLink(
  id: string,
  position: number,
  lookup: Map<string, { slug: string; name: string }>,
  base: string,
): NavLink {
  const term = lookup.get(id);
  return {
    id: `nav-${id}`,
    label: term?.name ?? id,
    href: term ? `${base}/${term.slug}` : `${base}/${id}`,
    position,
    visible: true,
  };
}

const shopChildren: NavLink[] = byPositionField(shopGroups).map((group) => ({
  id: group.id,
  label: group.heading,
  href: group.href,
  position: group.position,
  visible: true,
  children: group.termIds.map((termId, index) => termLink(termId, index + 1, categoriesById, '/category')),
}));

/** Top-level navigation. `position` here controls the header order. */
export const primaryNav: NavLink[] = byPositionField([
  {
    id: 'nav-shop',
    label: 'Shop',
    href: '/shop',
    position: 1,
    visible: true,
    children: shopChildren,
    feature: {
      title: 'The Essentials',
      href: '/collection/the-essentials',
      eyebrow: 'Collection',
      image: photo(7691098, 'White skincare products on a light background'),
    },
  },
  {
    id: 'nav-collections',
    label: 'Collections',
    href: '/collection/the-essentials',
    position: 2,
    visible: true,
    children: collections.map((collection, index) => ({
      id: `nav-${collection.id}`,
      label: collection.name,
      href: `/collection/${collection.slug}`,
      position: index + 1,
      visible: true,
    })),
    feature: {
      title: 'The Barrier Ritual',
      href: '/collection/the-barrier-ritual',
      eyebrow: 'Featured',
      image: photo(13794471, 'Open jar of barrier cream on marble'),
    },
  },
  {
    id: 'nav-concerns',
    label: 'Skin concerns',
    href: '/concern/dehydration',
    position: 3,
    visible: true,
    children: byPositionField(skinConcerns).map((concern, index) => ({
      id: `nav-${concern.id}`,
      label: concern.name,
      href: `/concern/${concern.slug}`,
      position: index + 1,
      visible: true,
    })),
    feature: {
      title: 'Not sure where to start?',
      href: '/faq#skin',
      eyebrow: 'Guidance',
      image: photo(6635916, 'Woman completing a calm skincare routine outdoors'),
    },
  },
  {
    id: 'nav-skin-types',
    label: 'Skin types',
    href: '/skin-type/dry',
    position: 4,
    visible: true,
    children: byPositionField(skinTypes).map((type, index) => ({
      id: `nav-${type.id}`,
      label: type.name,
      href: `/skin-type/${type.slug}`,
      position: index + 1,
      visible: true,
    })),
  },
  {
    id: 'nav-ingredients',
    label: 'Ingredients',
    href: '/ingredient/niacinamide',
    position: 5,
    visible: true,
    children: [
      ...byPositionField(ingredients)
        .slice(0, 10)
        .map((ingredient, index) => ({
          id: `nav-${ingredient.id}`,
          label: ingredient.name,
          href: `/ingredient/${ingredient.slug}`,
          position: index + 1,
          visible: true,
        })),
      {
        id: 'nav-ingredient-index',
        label: 'Full ingredient library →',
        href: '/ingredients',
        position: 99,
        visible: true,
      },
    ],
    feature: {
      title: 'Niacinamide',
      href: '/ingredient/niacinamide',
      eyebrow: 'In the library',
      image: photo(4119559, 'Serum bottles arranged on a white background'),
    },
  },
  {
    id: 'nav-journal',
    label: 'Journal',
    href: '/journal',
    position: 6,
    visible: true,
  },
  {
    id: 'nav-about',
    label: 'About',
    href: '/about',
    position: 7,
    visible: true,
  },
]);

/** Header utilities — account, wishlist, search, cart. */
export const utilityNav: NavLink[] = byPositionField([
  { id: 'util-account', label: 'Account', href: '/account', position: 1, visible: true },
  { id: 'util-wishlist', label: 'Wishlist', href: '/wishlist', position: 2, visible: true },
  { id: 'util-search', label: 'Search', href: '/search', position: 3, visible: true },
]);

/** Secondary navigation used by the account area. */
export const accountNav: NavLink[] = byPositionField([
  { id: 'acct-overview', label: 'Overview', href: '/account', position: 1, visible: true },
  { id: 'acct-orders', label: 'Orders', href: '/account/orders', position: 2, visible: true },
  { id: 'acct-wishlist', label: 'Wishlist', href: '/wishlist', position: 3, visible: true },
  { id: 'acct-addresses', label: 'Addresses', href: '/account/addresses', position: 4, visible: true },
  { id: 'acct-profile', label: 'Profile', href: '/account/profile', position: 5, visible: true },
  { id: 'acct-settings', label: 'Settings', href: '/account/settings', position: 6, visible: true },
]);

/**
 * Groups used by the footer "Shop by concern" / "Shop by skin type"
 * link lists, so the footer can never drift from the taxonomy.
 */
export function footerConcernLinks(): NavLink[] {
  return byPositionField(skinConcerns).map((concern, index) => ({
    id: `fc-concern-${concern.id}`,
    label: concern.name,
    href: `/concern/${concern.slug}`,
    position: index + 1,
    visible: true,
  }));
}

export function footerSkinTypeLinks(): NavLink[] {
  return byPositionField(skinTypes).map((type, index) => ({
    id: `fc-st-${type.id}`,
    label: type.name,
    href: `/skin-type/${type.slug}`,
    position: index + 1,
    visible: true,
  }));
}

export function footerCollectionLinks(): NavLink[] {
  return byPositionField(collections).map((collection, index) => ({
    id: `fc-col-${collection.id}`,
    label: collection.name,
    href: `/collection/${collection.slug}`,
    position: index + 1,
    visible: true,
  }));
}
