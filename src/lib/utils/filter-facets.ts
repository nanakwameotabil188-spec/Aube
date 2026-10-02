import type { Category, Ingredient, SkinConcern, SkinType, ProductType } from '@/types';

/**
 * Filter panel data.
 *
 * Built on the server, rendered on the client, so this lives in shared code
 * rather than in a `'use client'` module — a server component cannot call a
 * function that only exists on the client.
 */

export interface FacetCounts {
  categoryIds: { id: string; count: number }[];
  skinTypeIds: { id: string; count: number }[];
  skinConcernIds: { id: string; count: number }[];
  ingredientIds: { id: string; count: number }[];
  productTypes: { id: string; count: number }[];
  brands: { id: string; count: number }[];
  priceRange: { min: number; max: number };
  inStockCount: number;
  onSaleCount: number;
  ratedCount: number;
}

export interface FilterPanelData {
  categories: { id: string; name: string; count: number }[];
  skinTypes: { id: string; name: string; count: number }[];
  skinConcerns: { id: string; name: string; count: number }[];
  ingredients: { id: string; name: string; count: number }[];
  productTypes: { id: string; label: string; count: number }[];
  brands: { id: string; label: string; count: number }[];
  priceRange: { min: number; max: number };
  inStockCount: number;
  onSaleCount: number;
  ratedCount: number;
}

/** Plural labels for the product-type facet. */
export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  cleanser: 'Cleansers',
  essence: 'Essences & toners',
  serum: 'Serums',
  moisturiser: 'Moisturisers',
  eye: 'Eye care',
  mask: 'Masks & treatments',
  oil: 'Face oils',
  sunscreen: 'Sunscreen',
  tool: 'Tools',
};

export function buildFilterData(
  facets: FacetCounts,
  taxonomy: {
    categories: Category[];
    skinTypes: SkinType[];
    skinConcerns: SkinConcern[];
    ingredients: Ingredient[];
  },
): FilterPanelData {
  // An id with no matching term still has to render, or its count would vanish
  // from the panel and the shopper would see a count they cannot select.
  const label = (list: { id: string; name: string }[], id: string) => list.find((item) => item.id === id)?.name ?? id;

  return {
    categories: facets.categoryIds.map((item) => ({ ...item, name: label(taxonomy.categories, item.id) })),
    skinTypes: facets.skinTypeIds.map((item) => ({ ...item, name: label(taxonomy.skinTypes, item.id) })),
    skinConcerns: facets.skinConcernIds.map((item) => ({ ...item, name: label(taxonomy.skinConcerns, item.id) })),
    ingredients: facets.ingredientIds.map((item) => ({ ...item, name: label(taxonomy.ingredients, item.id) })),
    productTypes: facets.productTypes.map((item) => ({
      ...item,
      label: PRODUCT_TYPE_LABELS[item.id as ProductType] ?? item.id,
    })),
    brands: facets.brands.map((item) => ({ ...item, label: item.id })),
    priceRange: facets.priceRange,
    inStockCount: facets.inStockCount,
    onSaleCount: facets.onSaleCount,
    ratedCount: facets.ratedCount,
  };
}
