import 'server-only';

import { createAdminSupabaseClient } from './admin';
import { describeSupabaseConfig, hasServiceRoleKey } from './config';
import type { Tables } from './types';

/**
 * Admin read/write helpers.
 *
 * Every function returns `null` rather than throwing when Supabase is not
 * configured, so the panel renders a setup state instead of a stack trace. That
 * is deliberate: the panel ships with the storefront, which runs entirely on
 * mock content with no credentials at all.
 *
 * The service-role client bypasses RLS, so these queries read drafts and
 * unlisted rows the storefront can never see. They must not be reachable from
 * any customer-facing route.
 */

export type AdminStatus =
  | { ready: true }
  | { ready: false; reason: string; detail: string };

/** Why the admin panel can or cannot talk to the database right now. */
export function getAdminStatus(): AdminStatus {
  const { ready, message } = describeSupabaseConfig();
  if (!ready) return { ready: false, reason: 'Supabase is not configured', detail: message };
  if (!hasServiceRoleKey()) {
    return {
      ready: false,
      reason: 'Service role key is missing',
      detail: 'SUPABASE_SERVICE_ROLE_KEY is not set, so the panel cannot read drafts or write.',
    };
  }
  return { ready: true };
}

type ProductRow = Tables<'products'>;
type OrderRow = Tables<'orders'>;
type CustomerRow = Tables<'customers'>;

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export interface AdminOverview {
  products: number;
  visibleProducts: number;
  outOfStock: number;
  lowStock: number;
  orders: number;
  openOrders: number;
  revenue: number;
  customers: number;
}

export async function getOverview(): Promise<AdminOverview | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const [products, orders, customers] = await Promise.all([
    supabase.from('products').select('price, available_for_sale, stock_quantity, low_stock_threshold, visible'),
    supabase.from('orders').select('status, total'),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
  ]);

  if (products.error) throw new Error(products.error.message);
  if (orders.error) throw new Error(orders.error.message);

  const rows = products.data ?? [];
  const orderRows = orders.data ?? [];
  const open = new Set(['pending', 'processing']);

  return {
    products: rows.length,
    visibleProducts: rows.filter((r) => r.visible).length,
    outOfStock: rows.filter((r) => !r.available_for_sale || r.stock_quantity === 0).length,
    lowStock: rows.filter(
      (r) => r.stock_quantity > 0 && r.stock_quantity <= r.low_stock_threshold,
    ).length,
    orders: orderRows.length,
    openOrders: orderRows.filter((r) => open.has(r.status)).length,
    // Minor units, matching `Money.amount` and the `products.price` column.
    revenue: orderRows.reduce((sum, r) => sum + r.total, 0),
    customers: customers.count ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export interface AdminProductList {
  rows: Pick<
    ProductRow,
    | 'id' | 'slug' | 'name' | 'price' | 'stock_quantity'
    | 'available_for_sale' | 'visible' | 'updated_at'
  >[];
  total: number;
}

export interface AdminProductQuery {
  search?: string;
  page?: number;
  perPage?: number;
}

export async function listAdminProducts({
  search = '',
  page = 1,
  perPage = 20,
}: AdminProductQuery = {}): Promise<AdminProductList | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const from = Math.max(0, (page - 1) * perPage);
  const term = search.trim();

  let query = supabase
    .from('products')
    .select('id, slug, name, price, stock_quantity, available_for_sale, visible, updated_at', {
      count: 'exact',
    })
    .order('updated_at', { ascending: false })
    .order('name', { ascending: true })
    .range(from, from + perPage - 1);

  if (term) {
    // `or` takes a raw filter string, so the term has to be escaped rather than
    // parameterised. Doubling quotes and commas is enough to neutralise the
    // filter syntax here, since the column set is fixed.
    const safe = term.replace(/[%_,()]/g, '').slice(0, 80);
    if (safe) query = query.or(`name.ilike.%${safe}%,slug.ilike.%${safe}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return { rows: data ?? [], total: count ?? 0 };
}

/**
 * Everything the product editor needs in one round trip.
 *
 * The facets live in join tables, so they are read alongside the product row
 * rather than lazily: the editor renders every one of them at once, and seven
 * round trips to fill one form is a worse trade than a wider select.
 */
export type AdminProductDetail = ProductRow & {
  variants: Tables<'product_variants'>[];
  images: AdminProductImage[];
  badges: Tables<'product_badges'>[];
  keyIngredients: Tables<'product_key_ingredients'>[];
  collectionIds: string[];
  skinTypeIds: string[];
  skinConcernIds: string[];
  ingredientIds: string[];
  heroIngredientIds: string[];
};

export interface AdminProductImage {
  imageId: string;
  url: string;
  alt: string;
  position: number;
  isPrimary: boolean;
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const [
    product,
    variants,
    imageLinks,
    badges,
    keyIngredients,
    collections,
    skinTypes,
    concerns,
    ingredients,
    heroIngredients,
  ] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).maybeSingle(),
    supabase.from('product_variants').select('*').eq('product_id', id).order('position'),
    supabase
      .from('product_images')
      .select('image_id, position, is_primary')
      .eq('product_id', id)
      .order('position'),
    supabase.from('product_badges').select('*').eq('product_id', id).order('position'),
    supabase.from('product_key_ingredients').select('*').eq('product_id', id).order('position'),
    supabase.from('product_collections').select('collection_id').eq('product_id', id),
    supabase.from('product_skin_types').select('skin_type_id').eq('product_id', id),
    supabase.from('product_skin_concerns').select('skin_concern_id').eq('product_id', id),
    supabase.from('product_ingredients').select('ingredient_id').eq('product_id', id),
    supabase.from('product_hero_ingredients').select('ingredient_id').eq('product_id', id),
  ]);

  if (product.error) throw new Error(product.error.message);
  if (!product.data) return null;
  if (variants.error) throw new Error(variants.error.message);

  // The image table stores ids only, so the alt text and URL are resolved in a
  // second read rather than duplicated on the join row.
  const imageIds = (imageLinks.data ?? []).map((row) => row.image_id);
  const imageRows =
    imageIds.length > 0
      ? await supabase.from('images').select('id, url, alt').in('id', imageIds)
      : { data: [], error: null };
  if (imageRows.error) throw new Error(imageRows.error.message);

  const byId = new Map((imageRows.data ?? []).map((row) => [row.id, row]));

  return {
    ...product.data,
    variants: variants.data ?? [],
    images: (imageLinks.data ?? []).flatMap((row) => {
      const image = byId.get(row.image_id);
      if (!image) return [];
      return [
        {
          imageId: row.image_id,
          url: image.url,
          alt: image.alt,
          position: row.position,
          isPrimary: row.is_primary,
        },
      ];
    }),
    badges: badges.data ?? [],
    keyIngredients: keyIngredients.data ?? [],
    collectionIds: idsOf(collections.data, 'collection_id'),
    skinTypeIds: idsOf(skinTypes.data, 'skin_type_id'),
    skinConcernIds: idsOf(concerns.data, 'skin_concern_id'),
    ingredientIds: idsOf(ingredients.data, 'ingredient_id'),
    heroIngredientIds: idsOf(heroIngredients.data, 'ingredient_id'),
  };
}

function idsOf(rows: unknown[] | null, key: string): string[] {
  return (rows ?? [])
    .map((row) => (row as Record<string, string | undefined>)[key])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

/** Taxonomy options for the facet pickers, grouped by kind. */
export interface AdminTaxonomyGroup {
  kind: string;
  terms: { id: string; name: string }[];
}

export async function listTaxonomyForAdmin(): Promise<AdminTaxonomyGroup[] | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('taxonomy_terms')
    .select('id, name, kind, position')
    .order('kind')
    .order('position');

  if (error) throw new Error(error.message);

  const groups = new Map<string, { id: string; name: string }[]>();
  for (const term of data ?? []) {
    const list = groups.get(term.kind) ?? [];
    list.push({ id: term.id, name: term.name });
    groups.set(term.kind, list);
  }

  return [...groups.entries()].map(([kind, terms]) => ({ kind, terms }));
}

/** The `products` columns the edit form is allowed to write. */
export type ProductWrite = Partial<
  Pick<
    ProductRow,
    | 'name' | 'slug' | 'subtitle' | 'brand'
    | 'short_description' | 'description'
    | 'highlights' | 'benefits' | 'usage' | 'ingredients_text' | 'warnings'
    | 'price' | 'compare_at_price' | 'currency'
    | 'category_id' | 'product_type'
    | 'size' | 'stock_quantity' | 'available_for_sale' | 'low_stock_threshold'
    | 'dispatch_estimate'
    | 'is_featured' | 'is_best_seller' | 'is_new_arrival'
    | 'related_product_ids' | 'frequently_bought_with_ids'
    | 'visible' | 'position'
    | 'seo_title' | 'seo_description'
  >
>;

/**
 * Join-table and variant writes that accompany a product save.
 *
 * These are separate from `ProductWrite` because they are relation rows, not
 * columns, and because they are all replace-whole-set operations: the editor
 * submits the complete selection, so applying it is delete-then-insert rather
 * than a diff the caller could get subtly wrong.
 */
export interface ProductRelationsWrite {
  variants: VariantWrite[];
  imageIds: string[];
  primaryImageId: string | null;
  badges: { label: string; tone: string; position: number }[];
  keyIngredients: { ingredientId: string; note: string; position: number }[];
  collectionIds: string[];
  skinTypeIds: string[];
  skinConcernIds: string[];
  ingredientIds: string[];
  heroIngredientIds: string[];
}

export interface VariantWrite {
  id?: string;
  sku: string;
  name: string;
  size: string;
  price: number;
  compareAtPrice: number | null;
  stockQuantity: number;
  imageId: string | null;
  isDefault: boolean;
}

export async function createAdminProduct(
  id: string,
  values: ProductWrite,
): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const { error } = await supabase.from('products').insert({ id, ...values } as ProductRow);
  if (error) throw new Error(error.message);
  return id;
}

export async function updateAdminProduct(id: string, values: ProductWrite): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('products')
    .update(values as Partial<ProductRow>)
    .eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

/**
 * Replace a product's relation rows.
 *
 * Every table is cleared and rewritten inside one transaction-scoped sequence.
 * A partial failure is surfaced as an exception so the caller does not report a
 * successful save for a half-written product.
 */
export async function replaceProductRelations(
  productId: string,
  relations: ProductRelationsWrite,
): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const {
    variants,
    imageIds,
    primaryImageId,
    badges,
    keyIngredients,
    collectionIds,
    skinTypeIds,
    skinConcernIds,
    ingredientIds,
    heroIngredientIds,
  } = relations;

  // Variants are keyed by sku (unique), so the set is cleared first to let a
  // size be renamed without colliding with its own previous row.
  const { error: variantClear } = await supabase
    .from('product_variants')
    .delete()
    .eq('product_id', productId);
  if (variantClear) throw new Error(variantClear.message);

  if (variants.length > 0) {
    const { error } = await supabase.from('product_variants').insert(
      variants.map((variant, index) => ({
        id: variant.id ?? `var-${productId}-${Date.now().toString(36)}-${index}`,
        product_id: productId,
        sku: variant.sku,
        name: variant.name,
        size: variant.size,
        price: variant.price,
        compare_at_price: variant.compareAtPrice,
        stock_quantity: variant.stockQuantity,
        image_id: variant.imageId,
        position: index,
        is_default: variants.length === 1 ? true : variant.isDefault,
      })),
    );
    if (error) throw new Error(error.message);
  }

  const linkTables: [string, string, string[]][] = [
    ['product_images', 'image_id', imageIds],
    ['product_key_ingredients', 'ingredient_id', keyIngredients.map((entry) => entry.ingredientId)],
    ['product_collections', 'collection_id', collectionIds],
    ['product_skin_types', 'skin_type_id', skinTypeIds],
    ['product_skin_concerns', 'skin_concern_id', skinConcernIds],
    ['product_ingredients', 'ingredient_id', ingredientIds],
    ['product_hero_ingredients', 'ingredient_id', heroIngredientIds],
  ];

  for (const [table, column, values] of linkTables) {
    const { error: clearError } = await supabase
      .from(table)
      .delete()
      .eq('product_id', productId);
    if (clearError) throw new Error(clearError.message);

    if (values.length > 0) {
      const rows = values.map((value, index) => ({
        product_id: productId,
        [column]: value,
        position: index,
        ...(table === 'product_images' ? { is_primary: value === primaryImageId } : {}),
      }));
      const { error } = await supabase.from(table).insert(rows);
      if (error) throw new Error(error.message);
    }
  }

  const { error: badgeClear } = await supabase
    .from('product_badges')
    .delete()
    .eq('product_id', productId);
  if (badgeClear) throw new Error(badgeClear.message);

  if (badges.length > 0) {
    const { error } = await supabase.from('product_badges').insert(
      badges.map((badge, index) => ({
        id: `badge-${productId}-${index}`,
        product_id: productId,
        label: badge.label,
        tone: badge.tone,
        position: index,
      })),
    );
    if (error) throw new Error(error.message);
  }

  if (keyIngredients.length > 0) {
    const { error } = await supabase.from('product_key_ingredients').insert(
      keyIngredients.map((entry, index) => ({
        product_id: productId,
        ingredient_id: entry.ingredientId,
        note: entry.note,
        position: index,
      })),
    );
    if (error) throw new Error(error.message);
  }

  return true;
}

export async function deleteAdminProduct(id: string): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

/* ------------------------------------------------------------------ */
/* Orders and customers                                                */
/* ------------------------------------------------------------------ */

export type AdminOrder = Pick<
  OrderRow,
  'id' | 'number' | 'status' | 'customer_email' | 'total' | 'placed_at'
> & { line_count: number; payment_method_label: string | null };

export async function listAdminOrders(limit = 50): Promise<AdminOrder[] | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('orders')
    .select('id, number, status, customer_email, total, placed_at, payment_method_label, order_lines(count)')
    .order('placed_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const counted = row.order_lines as unknown as { count: number }[] | null;
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      customer_email: row.customer_email,
      total: row.total,
      placed_at: row.placed_at,
      // Shown under the status so the panel says how the order is being settled,
      // rather than leaving "Card" on a row where no card was charged.
      payment_method_label: row.payment_method_label ?? null,
      line_count: counted?.[0]?.count ?? 0,
    };
  });
}

export type AdminCustomer = Pick<
  CustomerRow,
  'id' | 'email' | 'full_name' | 'created_at'
> & { order_count: number; spend: number };

export async function listAdminCustomers(limit = 50): Promise<AdminCustomer[] | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('customers')
    .select('id, email, full_name, created_at, orders!inner(total)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const orders = (row.orders as unknown as { total: number }[]) ?? [];
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      created_at: row.created_at,
      order_count: orders.length,
      spend: orders.reduce((sum, o) => sum + o.total, 0),
    };
  });
}
