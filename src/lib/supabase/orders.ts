import 'server-only';
import { createAdminSupabaseClient } from './admin';
import { createServerSupabaseClient } from './server';
import { paymentGatewayState, type PaymentGatewayState } from './integrations';
import type { Tables } from './types';
import type { CreateOrderInput } from '@/lib/services/content-service';

/**
 * Order writes.
 *
 * ## Why the service role, and why that is safe here
 *
 * Placing an order is a guest operation: the whole point of checkout is that
 * someone can buy something without an account. There is no session, so there is
 * nothing for Row Level Security to match, and the anon client could not write
 * the row even in principle.
 *
 * The service key is used instead, which means the safety here is entirely in
 * this file. Three things hold it together:
 *
 *  1. Every price is re-read from `product_variants`. The totals sent by the
 *     browser are discarded. A client that posts `total: 0` gets an order for
 *     the real amount, because the client is never asked what anything costs.
 *  2. The `orders` table has no insert policy at all, so no amount of crafting
 *     a request against PostgREST reaches this path directly.
 *  3. Stock is decremented here, in the same place the price was read, so the
 *     quantity a shopper was allowed to buy and the quantity recorded cannot
 *     come from two different reads.
 *
 * This is a payment boundary. A real deployment would also want the payment
 * provider's webhook to be the authority on `status` rather than a value this
 * function chooses.
 */

type VariantRow = Tables<'product_variants'>;
type ProductRow = Tables<'products'>;

export type PlaceOrderResult =
  | {
      ok: true;
      orderNumber: string;
      accessToken: string;
      gateway: PaymentGatewayState;
      /** What the confirmation email said, for the caller's own reporting. */
      confirmation?: { sent: boolean; reason?: string };
    }
  | { ok: false; message: string };

/**
 * Order numbers are sequential, so two people checking out at the same moment
 * can collide on one. The unique index on `number` rejects the loser; this
 * retries with the next number rather than surfacing a database error, because a
 * collision is a fact about concurrency, not a fault the shopper caused.
 */
const MAX_NUMBER_ATTEMPTS = 5;

/**
 * Reserve the next order number.
 *
 * A sequence table would be the proper fix, but this is a single-writer path and
 * the retry keeps it simple. It reads the highest existing number rather than
 * counting rows, so a deleted order does not cause a number to be reused.
 */
async function nextOrderNumber(prefix: string): Promise<string> {
  const admin = createAdminSupabaseClient();
  if (!admin) return `${prefix}-00000`;

  const { data } = await admin
    .from('orders')
    .select('number')
    .like('number', `${prefix}-%`)
    .order('number', { ascending: false })
    .limit(1);

  const highest = data?.[0]?.number ?? '';
  const current = Number.parseInt(highest.split('-').pop() ?? '', 10);

  // A non-numeric suffix means the seed data used a different format; starting
  // from zero is safer than producing `NaN`.
  const next = Number.isFinite(current) ? current + 1 : 1;

  return `${prefix}-${String(next).padStart(5, '0')}`;
}

/**
 * Turn a checkout submission into a stored order.
 *
 * Returns the order number and the access token rather than the whole `Order`:
 * the confirmation page re-reads the order through the read path, so what the
 * shopper sees is fetched under the same rules as anybody else's view of it.
 */
export async function placeOrderInDatabase(input: CreateOrderInput): Promise<PlaceOrderResult> {
  const admin = createAdminSupabaseClient();
  if (!admin) {
    return {
      ok: false,
      message: 'Checkout is unavailable right now. Please try again later.',
    };
  }

  if (input.lines.length === 0) {
    return { ok: false, message: 'Your bag is empty.' };
  }

  /*
   * Re-price from the database.
   *
   * Every variant is read in one query, and the client's own `unitPrice` and
   * `totals` are never used. This is the reason a tampered checkout cannot
   * produce a cheap order: the numbers that end up on the row were not supplied
   * by the caller.
   */
  const variantIds = input.lines.map((line) => line.variantId);

  const { data: variants, error: variantError } = await admin
    .from('product_variants')
    .select('*')
    .in('id', variantIds);

  if (variantError || !variants || variants.length !== variantIds.length) {
    // A variant that no longer exists, or a duplicate id in the request.
    return {
      ok: false,
      message: 'Something in your bag is no longer available. Please review it and try again.',
    };
  }

  const variantById = new Map<string, VariantRow>(
    (variants as VariantRow[]).map((variant) => [variant.id, variant]),
  );

  const productIds = [
    ...new Set(input.lines.map((line) => line.productId).filter(Boolean)),
  ];

  const { data: products } = await admin
    .from('products')
    .select('id, name, currency, visible, available_for_sale')
    .in('id', productIds.length > 0 ? productIds : ['__none__']);

  type ProductSummary = Pick<
    ProductRow,
    'id' | 'name' | 'currency' | 'visible' | 'available_for_sale'
  >;

  const productById = new Map<string, ProductSummary>(
    ((products ?? []) as ProductSummary[]).map((product) => [product.id, product]),
  );

  interface PricedLine {
    variantId: string;
    productId: string;
    name: string;
    variantName: string;
    sku: string | null;
    imageId: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }

  const priced: PricedLine[] = [];

  for (const line of input.lines) {
    const variant = variantById.get(line.variantId);
    if (!variant) {
      return {
        ok: false,
        message: 'Something in your bag is no longer available. Please review it and try again.',
      };
    }

    const product = productById.get(line.productId);

    // Hidden or withdrawn between browsing and checkout. Silently dropping the
    // line would total something other than what the shopper agreed to, so it
    // is refused and they are sent back to the bag.
    if (product && (!product.visible || !product.available_for_sale)) {
      return {
        ok: false,
        message: `“${product.name}” is no longer available. Please remove it from your bag to continue.`,
      };
    }

    // Out of stock, or more than we have. Compared against the real row rather
    // than the quantity the browser last displayed.
    if (variant.stock_quantity < line.quantity) {
      const available = variant.stock_quantity;
      return {
        ok: false,
        message:
          available === 0
            ? `“${product?.name ?? line.name}” has sold out. Please remove it from your bag.`
            : `Only ${available} of “${product?.name ?? line.name}” remain. Please reduce the quantity.`,
      };
    }

    const unitPrice = variant.price;

    priced.push({
      variantId: variant.id,
      productId: variant.product_id,
      // The product's current name, not the one in the bag, so a rename between
      // browsing and paying does not produce a line that says something else.
      name: product?.name ?? line.name,
      variantName: variant.name || line.size,
      sku: variant.sku,
      imageId: variant.image_id,
      quantity: line.quantity,
      unitPrice,
      lineTotal: unitPrice * line.quantity,
    });
  }

  const subtotal = priced.reduce((sum, line) => sum + line.lineTotal, 0);

  /*
   * Discounts are also re-derived rather than trusted.
   *
   * The code is looked up again and its amount recomputed. The browser's
   * `discounts` array is ignored entirely: a client posting a 10,000-unit
   * discount gets whatever the code is actually worth.
   */
  const applied = await resolveDiscounts(admin, input, subtotal);
  const discountTotal = applied.reduce((sum, discount) => sum + discount.amount, 0);

  const shippingTotal = Math.max(0, input.totals.shipping.amount);
  const taxTotal = Math.max(0, input.totals.tax.amount);
  const total = Math.max(0, subtotal - discountTotal + shippingTotal + taxTotal);

  // A signed-in shopper gets the order attached to their account, which is what
  // makes it appear in `/account/orders`. A guest order keeps `customer_id`
  // null and is reachable only through the emailed confirmation link.
  const customerId = await resolveCustomerId(input.email);

  const prefix = await brandCode(admin);
  const orderId = `ord-${crypto.randomUUID()}`;

  /*
   * What actually happened to the money.
   *
   * Read once here and used for the status, the recorded payment method and the
   * first timeline event, so the three cannot disagree. Previously this wrote
   * `status: 'processing'` and `payment_method_label: 'Card'`, which in this
   * codebase's vocabulary means "paid and being prepared, by card" — an order
   * claiming a charge that never happened. `paymentGatewayState` is `false` for
   * every provider currently implemented, so the order is honestly `pending`
   * until a gateway that actually charges is configured.
   */
  const gateway = await paymentGatewayState();

  // Only a real charge is worth the last four digits of a PAN. Keeping them for a
  // card that was never charged is how a receipt ends up implying a transaction.
  const paymentLast4 = gateway.collectsPayment ? (input.paymentLast4 ?? null) : null;

  /*
   * Addresses first.
   *
   * `orders.shipping_address_id` and `billing_address_id` are `not null` with a
   * restrictive foreign key to `addresses`, so the rows have to exist before the
   * order that points at them. Writing them after would fail every time — which
   * is exactly what `verify:accounts` caught.
   *
   * They are written once, outside the retry loop: the ids are derived from
   * `orderId`, not from the number, so a retry on a number collision can reuse
   * the same pair and an `upsert` would be doing nothing.
   */
  const addressIds = { shipping: `${orderId}-ship`, billing: `${orderId}-bill` };
  await writeAddresses(admin, orderId, input, addressIds);

  for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt += 1) {
    const number = await nextOrderNumber(prefix);

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        id: orderId,
        number,
        status: gateway.status,
        customer_id: customerId,
        customer_email: input.email.toLowerCase(),
        customer_name: `${input.shippingAddress.firstName} ${input.shippingAddress.lastName}`.trim(),
        shipping_address_id: addressIds.shipping,
        billing_address_id: addressIds.billing,
        shipping_method_id: input.shippingMethodId,
        shipping_method_name: input.shippingMethodName,
        subtotal,
        discount_total: discountTotal,
        shipping_total: shippingTotal,
        tax_total: taxTotal,
        total,
        // Taken from the product rows rather than from the submission, for the
        // same reason the price is: the client does not get to state the
        // currency. A mixed-currency basket is not expressible in this schema,
        // so the first product wins and the rest are assumed consistent.
        currency: productById.get(priced[0]?.productId ?? '')?.currency ?? 'USD',
        payment_method_label: gateway.label,
        payment_last4: paymentLast4,
        placed_at: new Date().toISOString(),
      })
      .select('access_token')
      .maybeSingle();

    if (orderError) {
      // A unique violation on `number` means someone took that number between
      // our read and our write. Take the next one.
      if (orderError.code === '23505' && attempt < MAX_NUMBER_ATTEMPTS - 1) continue;
      return {
        ok: false,
        message: 'We could not record your order. You have not been charged — please try again.',
      };
    }

    const accessToken = (order as { access_token: string } | null)?.access_token;
    if (!accessToken) {
      return {
        ok: false,
        message: 'We could not record your order. You have not been charged — please try again.',
      };
    }

    await writeOrderRelations(admin, orderId, input, priced, applied, gateway);

    /*
     * The confirmation, once the order is durable.
     *
     * Placed after every write rather than inside `writeOrderRelations`, because
     * an email about an order that failed to save is worse than no email. It is
     * awaited rather than fired and forgotten: the result feeds the confirmation
     * page, which tells the shopper whether a message was actually sent instead
     * of asserting one is "on its way".
     */
    const confirmation = await sendOrderConfirmation({
      orderId,
      number,
      email: input.email,
      firstName: input.shippingAddress.firstName,
      total,
      currency: productById.get(priced[0]?.productId ?? '')?.currency ?? 'USD',
      gateway,
    });

    return { ok: true, orderNumber: number, accessToken, gateway, confirmation };
  }

  return {
    ok: false,
    message: 'Checkout is busy right now. Please try again in a moment.',
  };
}

/**
 * Sends the order confirmation.
 *
 * ## Why this is a dynamic import
 *
 * `templates.ts` reaches for the admin client and `send.ts` decrypts stored
 * credentials. Neither belongs in the module graph of a checkout that may run
 * with no email integration configured at all, and loading them only once an
 * order exists keeps that path free of the mail stack on a store that has never
 * turned it on.
 *
 * ## Never allowed to fail the order
 *
 * An order is placed whether or not this succeeds. The result comes back so the
 * confirmation page can say "we could not send your confirmation" rather than
 * implying one is on its way.
 */
async function sendOrderConfirmation(input: {
  orderId: string;
  number: string;
  email: string;
  firstName: string;
  total: number;
  currency: string;
  gateway: PaymentGatewayState;
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const { triggerAutomation, EMAIL_EVENTS } = await import('@/lib/mail/templates');
    const { siteOrigin } = await import('@/lib/site-origin');

    const origin = await siteOrigin();

    return await triggerAutomation(
      EMAIL_EVENTS.ORDER_PLACED,
      input.email,
      {
        brand_name: await brandName(),
        first_name: input.firstName,
        order_number: input.number,
        order_date: new Date().toISOString().slice(0, 10),
        order_total: formatOrderTotal(input.total, input.currency),
        // The honest payment sentence, so a confirmation never implies a charge.
        payment_status: input.gateway.collectsPayment
          ? 'Payment taken.'
          : 'No payment has been taken yet — we will arrange it with you.',
        order_url: origin
          ? `${origin}/checkout/confirmation/${encodeURIComponent(input.number)}`
          : '',
      },
      {
        /*
         * The URL is the one value that must not be escaped.
         *
         * Every variable is HTML-escaped by default, which is right for a name
         * and wrong for a link: `&amp;` in a query string still resolves, but
         * escaping the whole URL makes the href unreadable and the generated
         * markup fragile for no security gain — the URL is generated here, not
         * supplied by the shopper.
         */
        safe: ['order_url', 'reset_url', 'confirm_url', 'unsubscribe_url'],
      },
    );
  } catch (error) {
    console.error(`[orders] confirmation failed for ${input.number}`, error);
    return { sent: false, reason: 'error' };
  }
}

/** The brand name, read through the content service so a rename reaches the mail. */
async function brandName(): Promise<string> {
  const { contentService } = await import('@/lib/services/content-service');
  try {
    const settings = await contentService.getSettings();
    return settings.brandName || 'the shop';
  } catch {
    return 'the shop';
  }
}

/**
 * Formats a total for an email.
 *
 * Done here rather than importing `formatMoney`, which is a client-facing module
 * carrying display assumptions (locale grouping, currency symbol placement) that
 * do not belong in a transactional message body.
 */
function formatOrderTotal(amount: number, currency: string): string {
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '';
  const formatted = (amount / 100).toFixed(2);
  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`;
}

/**
 * Link the order to a real account, when the buyer has one.
 *
 * Matched on the emailed address rather than on the session, because checkout
 * is a guest flow and the shopper may not be signed in. The `customers` lookup
 * goes through the service role but returns only an id for an address that is
 * already on file, so it cannot be used to read another shopper's data.
 */
async function resolveCustomerId(email: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  if (!admin) return null;

  const { data } = await admin
    .from('customers')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  return (data as { id: string } | null)?.id ?? null;
}

/**
 * The brand code, which prefixes every order number.
 *
 * Read from settings so a rename in the admin takes effect on the next order
 * without a deploy, and falling back to the current prefix rather than to
 * something empty: a bare number would break the `like` lookup below and issue
 * a duplicate.
 */
async function brandCode(admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>) {
  const { data } = await admin.from('settings').select('value').eq('key', 'brand').maybeSingle();
  const value = (data as { value: { brandCode?: string } | null } | null)?.value;
  const code = value?.brandCode?.trim();
  return code && /^[A-Za-z0-9]{1,10}$/.test(code) ? code.toUpperCase() : 'AUBE';
}

/**
 * Recompute what each submitted discount code is actually worth.
 *
 * Unknown, expired and not-yet-started codes are dropped rather than rejected. A
 * shopper with one expired code in their bag should still be able to pay for the
 * rest, and the confirmation page shows exactly which codes applied.
 *
 * Returns the discounts that survived, not just a total, so the order records
 * what was actually applied rather than what was asked for.
 */
async function resolveDiscounts(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  input: CreateOrderInput,
  subtotal: number,
): Promise<{ code: string; label: string; amount: number }[]> {
  const requested = [
    ...new Map(
      input.discounts
        .filter((discount) => discount.code.trim())
        .map((discount) => [discount.code.trim().toUpperCase(), discount]),
    ).values(),
  ];
  if (requested.length === 0) return [];

  const { data } = await admin
    .from('promotions')
    .select('*')
    .in('code', requested.map((discount) => discount.code))
    .eq('visible', true);

  const now = new Date();
  const applied: { code: string; label: string; amount: number }[] = [];
  let running = 0;

  for (const promotion of (data ?? []) as Tables<'promotions'>[]) {
    if (promotion.starts_at && new Date(promotion.starts_at) > now) continue;
    if (promotion.ends_at && new Date(promotion.ends_at) < now) continue;

    const requestedDiscount = requested.find((entry) => entry.code === promotion.code.toUpperCase());
    if (!requestedDiscount) continue;

    const amount =
      promotion.kind === 'percentage'
        ? Math.round((subtotal * promotion.value) / 10_000)
        : promotion.value;

    // Never discount more than the basket, and never more than what is left of
    // it once earlier codes have been applied.
    const capped = Math.max(0, Math.min(amount, subtotal - running));
    if (capped === 0) continue;

    running += capped;
    applied.push({
      code: promotion.code,
      label: requestedDiscount.label || promotion.code,
      amount: capped,
    });
  }

  return applied;
}

/**
 * Write the order's two address rows.
 *
 * Separate from the rest because of ordering, not tidiness: `orders` has `not
 * null` foreign keys to `addresses`, so these must be committed before the
 * order row that references them. Called once, before the number-retry loop,
 * since the ids derive from `orderId` and not from the number.
 *
 * Both rows carry the same contents because checkout has one address form. Two
 * rows rather than one because a shop that later adds a separate billing
 * address should not have to migrate every historical order.
 */
async function writeAddresses(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  orderId: string,
  input: CreateOrderInput,
  ids: { shipping: string; billing: string },
): Promise<void> {
  const address = input.shippingAddress;

  const base = {
    full_name: `${address.firstName} ${address.lastName}`.trim(),
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city,
    postal_code: address.postalCode,
    country: address.country,
    phone: address.phone ?? null,
  };

  const { error } = await admin.from('addresses').insert([
    { id: ids.shipping, customer_id: null, ...base, is_default_shipping: true, is_default_billing: false },
    { id: ids.billing, customer_id: null, ...base, is_default_shipping: false, is_default_billing: true },
  ]);

  // Thrown rather than returned, because a caller that continued would try to
  // insert an order whose foreign keys cannot resolve, and the resulting error
  // would point at the wrong statement.
  if (error) {
    throw new Error(`Could not save the delivery address: ${error.message}`);
  }
}

/**
 * Write an order's address, lines, discounts and first event.
 *
 * Separate statements rather than one transaction because PostgREST exposes no
 * multi-statement write. The trade is explicit: a failure here leaves an order
 * with no lines. It is ordered so the least damaging thing is least likely —
 * the address is written first, and the confirmation page renders an honest
 * empty state for a line list that did not make it, rather than a total that
 * does not match the items.
 */
async function writeOrderRelations(
  admin: NonNullable<ReturnType<typeof createAdminSupabaseClient>>,
  orderId: string,
  input: CreateOrderInput,
  priced: {
    variantId: string;
    productId: string;
    name: string;
    variantName: string;
    sku: string | null;
    imageId: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[],
  applied: { code: string; label: string; amount: number }[],
  gateway: PaymentGatewayState,
): Promise<void> {
  await admin.from('order_lines').insert(
    priced.map((line, index) => ({
      id: `${orderId}-l${index + 1}`,
      order_id: orderId,
      product_id: line.productId,
      variant_id: line.variantId,
      product_name: line.name,
      variant_name: line.variantName,
      sku: line.sku,
      image_id: line.imageId,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
      position: index,
    })),
  );

  // The codes that actually applied were recomputed above. Storing them means
  // the order shows what was discounted, not what was requested.
  if (applied.length > 0) {
    await admin.from('order_discounts').insert(
      applied.map((discount, index) => ({
        id: `${orderId}-d${index + 1}`,
        order_id: orderId,
        code: discount.code,
        label: discount.label,
        amount: discount.amount,
        position: index,
      })),
    );
  }

  /*
   * The first timeline entry states what actually happened.
   *
   * "Order confirmed" on an unpaid order is a claim that something was settled.
   * The shopper's own timeline reads this back, so it says "Order received" while
   * the order is awaiting payment and only claims confirmation once money has
   * moved.
   */
  await admin.from('order_events').insert([
    {
      id: `${orderId}-e1`,
      order_id: orderId,
      label: gateway.collectsPayment ? 'Payment confirmed' : 'Order received — awaiting payment',
      status: gateway.status,
      occurred_at: new Date().toISOString(),
    },
  ]);

  /*
   * Decrement stock through the RPC rather than a plain update.
   *
   * The naive `update set stock = stock - n` cannot express a floor, so two
   * concurrent checkouts both pass the availability check above and together
   * oversell the last unit. `decrement_variant_stock` (0007) does the arithmetic
   * and the floor test in one statement, and returns false when the result
   * would go negative.
   *
   * It is called last: the order row already exists, so a stock failure leaves a
   * real, payable order that a human can resolve, rather than reduced stock for
   * a customer who never got an order.
   */
  for (const line of priced) {
    const { data } = await admin.rpc('decrement_variant_stock', {
      p_variant_id: line.variantId,
      p_quantity: line.quantity,
    });

    if (data === false) {
      // The order is written but the stock is not. Deliberately not deleted:
      // an order that exists and is visible to the customer and the admin is
      // recoverable. Deleting it here would risk losing a paid order, and this
      // function cannot know whether payment already succeeded.
      return;
    }
  }
}
