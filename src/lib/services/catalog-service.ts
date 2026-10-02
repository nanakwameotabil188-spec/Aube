/**
 * Catalog service — the public entry point.
 *
 * Everything above this line in the app calls these seven services and never
 * imports from `@/data` or from a Supabase client directly. The implementation
 * behind them is chosen by `DATA_SOURCE`; see `repositories/index.ts`.
 *
 * This indirection is what lets the storefront move from mock content to a real
 * database without a single component changing.
 */
export {
  productService,
  reviewService,
  categoryService,
  collectionService,
  ingredientService,
  skinTypeService,
  skinConcernService,
  loadTermPage,
  activeSource,
  type TermPageData,
} from './repositories';
