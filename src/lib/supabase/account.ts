import 'server-only';
import { cache } from 'react';
import type { ServerSupabaseClient } from './server';
import { createServerSupabaseClient } from './server';
import type { Tables } from './types';
import type { Address, Customer, Order, OrderLine, OrderStatus } from '@/types';

/**
 * Customer account data.
 *
 * Everything here reads through the cookie-scoped anon client, never the
 * service role, so Row Level Security is the thing actually authorising the
 * request. That is the point: a customer-owned read that quietly used the
 * service key would be correct by accident and would start leaking the moment
 * a policy was edited.
 *
 * Reads return `null` for "not configured" and `[]` for "no rows", never throw
 * into a component. `DATA_SOURCE=mock` has no accounts to read, so the account
 * pages render an honest empty state instead of pretending someone is signed in.
 */

type OrderRow = Tables<'orders'>;
type OrderLineRow = Tables<'order_lines'>;
type OrderDiscountRow = Tables<'order_discounts'>;
type OrderEventRow = Tables<'order_events'>;
type AddressRow = Tables<'addresses'>;
type CustomerRow = Tables<'customers'>;

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export interface AccountSession {
  userId: string;
  email: string;
  /** True once the shopper has confirmed their address. */
  emailConfirmed: boolean;
}

/**
 * The signed-in shopper, or `null`.
 *
 * `getUser()` rather than `getSession()` or `getClaims()`: the session arrives
 * in an httpOnly cookie, which is exactly the "insecure storage medium" case
 * where Supabase's own guidance is to have the Auth server revalidate rather
 * than trust the token that came off the wire. That costs a network round trip,
 * which is why the function is wrapped in `cache()` below.
 *
 * `cached` matters because both the account layout and the page beneath it ask
 * the same question, and a Server Component render shares a request. Without it
 * a single page view makes two identical authenticated round trips to Supabase.
 */
export const getAccountSession = cache(async (): Promise<AccountSession | null> => {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  return {
    userId: user.id,
    email: user.email,
    // True once the shopper has confirmed their address.
    emailConfirmed: user.email_confirmed_at != null,
  };
});

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  // A profile created at checkout can have an empty `full_name`, which is the
  // column default. Returning two empty strings rather than one keeps the
  // `Customer` contract's `firstName` required.
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

function mapAddress(row: AddressRow): Address {
  const name = splitName(row.full_name);
  return {
    id: row.id,
    // `addresses` has no label column. A stored address is a delivery address
    // by definition, and a second fabricated label would be a detail the
    // database does not actually hold.
    label: 'Saved address',
    firstName: name.firstName,
    lastName: name.lastName,
    line1: row.line1,
    line2: row.line2 ?? undefined,
    city: row.city,
    region: row.region ?? undefined,
    postalCode: row.postal_code,
    country: row.country,
    phone: row.phone ?? undefined,
    isDefaultShipping: row.is_default_shipping,
    isDefaultBilling: row.is_default_billing,
  };
}

/**
 * The shopper's own profile.
 *
 * RLS scopes this to the caller's row, so the query is `select *` by id rather
 * than a filter: if the policy ever stops working, this returns nothing instead
 * of somebody else's data.
 */
export async function getAccountCustomer(): Promise<Customer | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  /*
   * `maybeSingle()`, not a filter by id.
   *
   * RLS scopes this to exactly one row — the caller's own — so a filter would
   * add nothing and would hide the failure mode. If the policy ever breaks and
   * two rows come back, this returns `null` and renders as a signed-out or
   * empty state rather than showing whichever row arrived first.
   */
  const { data, error } = await supabase.from('customers').select('*').maybeSingle();
  if (error || !data) return null;

  const customer = mapCustomer(data);
  customer.addresses = await getAccountAddresses();
  return customer;
}

function mapCustomer(row: CustomerRow): Customer {
  const name = splitName(row.full_name);
  return {
    id: row.id,
    email: row.email,
    firstName: name.firstName,
    lastName: name.lastName,
    phone: row.phone ?? undefined,
    addresses: [],    // There is no marketing-consent column. Reporting `false` keeps the
    // preference off by default rather than claiming consent the shop does not
    // hold; `src/data` is the only place this was ever set true.
    marketingOptIn: false,
    createdAt: row.created_at,
  };
}

export async function getAccountAddresses(): Promise<Address[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .order('is_default_shipping', { ascending: false })
    .order('created_at', { ascending: true });
  if (error || !data) return [];

  return data.map(mapAddress);
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

interface OrderRelations {
  order_lines: OrderLineRow[];
  order_discounts: OrderDiscountRow[];
  order_events: OrderEventRow[];
  shipping_address: AddressRow | null;
  billing_address: AddressRow | null;
}

const EMPTY_ADDRESS: Address = {
  id: '',
  label: 'Address unavailable',
  firstName: '',
  lastName: '',
  line1: '',
  city: '',
  postalCode: '',
  country: '',
  isDefaultShipping: false,
  isDefaultBilling: false,
};

const money = (cents: number) => ({ amount: cents, currency: 'USD' as const });

/**
 * Order rows plus everything needed to render one.
 *
 * Four separate selects rather than one wide embed. `order_lines` needs a join to
 * `images` for the thumbnail, and PostgREST will not embed a relation nested
 * two levels deep, so the line rows and their images come back as two sets and
 * are stitched here.
 */
async function loadOrderRelations(
  supabase: ServerSupabaseClient,
  orders: OrderRow[],
): Promise<Map<string, OrderRelations>> {
  const result = new Map<string, OrderRelations>();
  if (orders.length === 0) return result;

  const orderIds = orders.map((order) => order.id);
  for (const id of orderIds) {
    result.set(id, {
      order_lines: [],
      order_discounts: [],
      order_events: [],
      shipping_address: null,
      billing_address: null,
    });
  }

  const [lines, lineImages, discounts, events, addresses] = await Promise.all([
    supabase.from('order_lines').select('*').in('order_id', orderIds).order('position'),
    supabase.from('images').select('id, url, alt'),
    supabase.from('order_discounts').select('*').in('order_id', orderIds).order('position'),
    supabase.from('order_events').select('*').in('order_id', orderIds).order('occurred_at'),
    supabase.from('addresses').select('*').in('id', orders.flatMap((o) => [o.shipping_address_id, o.billing_address_id])),
  ]);

  const imageById = new Map((lineImages.data ?? []).map((image) => [image.id, image]));
  const addressById = new Map((addresses.data ?? []).map((row) => [row.id, row]));

  for (const line of lines.data ?? []) {
    result.get(line.order_id)?.order_lines.push(line);
  }

  for (const discount of discounts.data ?? []) {
    result.get(discount.order_id)?.order_discounts.push(discount);
  }
  for (const event of events.data ?? []) {
    result.get(event.order_id)?.order_events.push(event);
  }

  for (const order of orders) {
    const entry = result.get(order.id);
    if (!entry) continue;
    entry.shipping_address = addressById.get(order.shipping_address_id) ?? null;
    entry.billing_address = addressById.get(order.billing_address_id) ?? null;
  }

  return result;
}

/**
 * A line image is looked up from the whole library by id rather than joined.
 *
 * `order_lines` is public-readable, so the image lookup is too — there is no
 * per-customer scope to lose here, and a second join would have to be repeated
 * for every one of the five order queries in this file.
 */
function mapOrderLine(
  line: OrderLineRow,
  imageById: Map<string, { id: string; url: string; alt: string }>,
): OrderLine {
  const image = line.image_id ? (imageById.get(line.image_id) ?? null) : null;
  return {
    id: line.id,
    productId: line.product_id ?? '',
    variantId: line.variant_id ?? '',
    name: line.product_name,
    size: line.variant_name,
    // An order line has no slug. A deleted product has no slug either, and a
    // product page reached from an order is reached by id in the catalogue, so
    // this stays empty and the UI renders the name as plain text.
    slug: '',
    quantity: line.quantity,
    unitPrice: money(line.unit_price),
    image: {
      id: image?.id ?? '',
      url: image?.url ?? '',
      alt: image?.alt ?? line.product_name,
      position: 0,
      // A line image is decorative next to the product name it sits under, so
      // it never claims to be the primary image of anything.
      isPrimary: false,
    },
  };
}

/**
 * Turn order events into a progress timeline.
 *
 * The last recorded event is the current position, and everything before it
 * happened. That is the honest reading of an append-only event log: a `cancelled`
 * event means the chain stopped there, so nothing after it is marked complete
 * even if a later row exists from a manual correction.
 *
 * No placeholder events are invented. An order with one event shows one dot, not
 * four, because claiming a parcel is "on its way" that has no corresponding
 * event would be a fabrication — this shop does not state what it cannot see.
 */
function buildTimeline(events: OrderEventRow[]) {
  const cancelledAt = events.find((event) => event.status === 'cancelled')?.occurred_at ?? null;
  const lastAt = events.at(-1)?.occurred_at ?? null;

  return events.map((event) => ({
    id: event.id,
    label: event.label,
    at: event.occurred_at,
    completed:
      event.occurred_at === lastAt ||
      (cancelledAt !== null && event.occurred_at <= cancelledAt),
  }));
}

function mapOrder(
  order: OrderRow,
  relations: OrderRelations,
  imageById: Map<string, { id: string; url: string; alt: string }>,
): Order {
  const address = relations.shipping_address;
  return {
    id: order.id,
    number: order.number,
    status: order.status as OrderStatus,
    customerEmail: order.customer_email,
    customerName: order.customer_name,
    lines: relations.order_lines.map((line) => mapOrderLine(line, imageById)),
    // `type` and `value` are not stored per discount. The amount is, because
    // that is what the shopper was charged and what the order must reproduce
    // later even if the code's terms change. The kind is reconstructed as
    // `fixed` because a stored amount is by definition an absolute value.
    discounts: relations.order_discounts.map((discount) => ({
      id: discount.id,
      code: discount.code,
      label: discount.label,
      type: 'fixed' as const,
      value: discount.amount,
      amount: money(discount.amount),
    })),
    shippingAddress: address ? mapAddress(address) : EMPTY_ADDRESS,
    billingAddress: relations.billing_address
      ? mapAddress(relations.billing_address)
      : (address ? mapAddress(address) : EMPTY_ADDRESS),
    shippingMethodId: order.shipping_method_id,
    shippingMethodName: order.shipping_method_name,
    totals: {
      subtotal: money(order.subtotal),
      discountTotal: money(order.discount_total),
      shipping: money(order.shipping_total),
      tax: money(order.tax_total),
      total: money(order.total),
      /*
       * Progress toward free shipping is a property of the basket, not of a
       * placed order, and an order is never re-calculated. Reporting 0/1 means
       * any meter component renders as "not applicable" on an order page, which
       * is honest, rather than implying a threshold that applied at checkout.
       */
      freeShippingProgress: 0,
      freeShippingThreshold: money(0),
    },
    paymentMethodLabel: order.payment_method_label,
    paymentLast4: order.payment_last4 ?? undefined,
    trackingNumber: order.tracking_number ?? undefined,
    trackingUrl: order.tracking_url ?? undefined,
    placedAt: order.placed_at,
    updatedAt: order.updated_at,
    /*
     * The timeline marks the latest event complete and everything before it,
     * so a shopper sees progress rather than a set of disconnected dots. A
     * cancelled order breaks the chain: nothing after the cancellation happened.
     */
    timeline: buildTimeline(relations.order_events),
  };
}

/** The signed-in shopper's orders, newest first. RLS scopes this to them. */
export async function getAccountOrders(): Promise<Order[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('placed_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];

  const relations = await loadOrderRelations(supabase, data);

  const { data: images } = await supabase.from('images').select('id, url, alt');
  const imageById = new Map((images ?? []).map((image) => [image.id, image]));

  return data.map((order) => mapOrder(order, relations.get(order.id)!, imageById));
}

/**
 * One order, for the account's order detail page.
 *
 * Takes the order id rather than the number: the id is a uuid, and unlike the
 * sequential order number it does not leak neighbouring orders to anyone who
 * edits the URL.
 */
export async function getAccountOrder(id: string): Promise<Order | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;

  const relations = await loadOrderRelations(supabase, [data]);
  const { data: images } = await supabase.from('images').select('id, url, alt');
  const imageById = new Map((images ?? []).map((image) => [image.id, image]));

  return mapOrder(data, relations.get(data.id)!, imageById);
}

/* ------------------------------------------------------------------ */
/* Order lookup for the confirmation page                              */
/* ------------------------------------------------------------------ */

/**
 * The result of a confirmation-page lookup.
 *
 * `configured` is load-bearing and exists because "there is no database" and
 * "you may not see this order" must not collapse into the same value. The
 * confirmation page falls back to the in-memory mock when nothing is
 * configured, so a lookup that returned a bare `null` for a *refused* request
 * would let anyone read any order by its number — the exact thing the access
 * token exists to prevent.
 */
export interface ConfirmationLookup {
  /** False when Supabase is not configured at all; the caller may use the mock. */
  configured: boolean;
  /** Null when the request could not be authorised. */
  order: Order | null;
}

/**
 * Find an order for a confirmation page.
 *
 * Two callers, two proofs. A signed-in shopper is matched on ownership, which
 * RLS enforces. A guest — someone who checked out without an account — has no
 * session to match against, so they must present the `access_token` minted when
 * the order was placed. The order number alone is never sufficient: it is a
 * short sequential string, so accepting it on its own would let anyone read
 * another shopper's address by counting.
 */
export async function getOrderForConfirmation(
  number: string,
  accessToken: string | null,
  opts: { signedIn: boolean },
): Promise<ConfirmationLookup> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { configured: false, order: null };

  if (opts.signedIn) {
    // RLS limits this to the caller's orders, so a token is not required.
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('number', number)
      .maybeSingle();

    if (error || !data) return { configured: true, order: null };

    const relations = await loadOrderRelations(supabase, [data]);
    const { data: images } = await supabase.from('images').select('id, url, alt');
    const imageById = new Map((images ?? []).map((image) => [image.id, image]));

    return {
      configured: true,
      order: mapOrder(data, relations.get(data.id)!, imageById),
    };
  }

  // A guest with no token is refused outright. Returning `configured: true` here
  // is the whole point: it must not be mistaken for an unconfigured project,
  // which would let the caller fall back to a lookup by number.
  if (!accessToken) return { configured: true, order: null };

  // Service role, not the anon client: a guest has no session, so RLS would
  // refuse the read even with a valid token. Both the number *and* the token
  // must match, and the token is 24 random bytes, so this is not guessable.
  const { createAdminSupabaseClient } = await import('./admin');
  const admin = createAdminSupabaseClient();
  if (!admin) return { configured: true, order: null };

  const { data, error } = await admin
    .from('orders')
    .select('*')
    .eq('number', number)
    .eq('access_token', accessToken)
    .maybeSingle();

  if (error || !data) return { configured: true, order: null };

  const relations = await loadOrderRelations(admin as ServerSupabaseClient, [data]);
  const { data: images } = await admin.from('images').select('id, url, alt');
  const imageById = new Map((images ?? []).map((image) => [image.id, image]));

  return {
    configured: true,
    order: mapOrder(data, relations.get(data.id)!, imageById),
  };
}
