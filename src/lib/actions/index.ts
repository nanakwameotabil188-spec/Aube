'use server';

/**
 * Server actions.
 *
 * The browser never imports the data layer directly. Every call a client
 * component makes into a service goes through one of these, which is what lets
 * the services sit behind a server-only Supabase client without dragging
 * `next/headers` into the browser bundle.
 *
 * Returning domain objects (rather than rendering) keeps the call sites shaped
 * exactly as they were when they called the service inline.
 */

import type { Product } from '@/types';
import { productService } from '@/lib/services/catalog-service';
import {
  accountService,
  contentService,
  type CreateOrderInput,
} from '@/lib/services/content-service';
import { subscribeToNewsletter as persistSubscription } from '@/lib/supabase/newsletter';
import { placeOrderInDatabase, type PlaceOrderResult } from '@/lib/supabase/orders';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/supabase/rate-limit';
import { triggerAutomation, EMAIL_EVENTS } from '@/lib/mail/templates';
import { siteOrigin } from '@/lib/site-origin';

/** The shop's name for `{{brand_name}}`, shared with the auth actions. */
async function brandName(): Promise<string> {
  try {
    const settings = await contentService.getSettings();
    return settings.brandName || 'the shop';
  } catch {
    return 'the shop';
  }
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export interface SearchResults {
  products: Product[];
  categories: { id: string; name: string; slug: string; image?: Product['thumbnail'] }[];
  concerns: { id: string; name: string; slug: string; image?: Product['thumbnail'] }[];
  ingredients: { id: string; name: string; slug: string; image?: Product['thumbnail'] }[];
}

/** Powers the search overlay's instant results. */
export async function searchProducts(term: string, limit = 6): Promise<SearchResults> {
  const trimmed = term.trim();
  if (!trimmed) return { products: [], categories: [], concerns: [], ingredients: [] };

  const suggestions = await productService.getSuggestions(trimmed);

  return {
    products: suggestions.products.slice(0, limit),
    categories: suggestions.categories,
    concerns: suggestions.concerns,
    ingredients: suggestions.ingredients,
  };
}

/* ------------------------------------------------------------------ */
/* Promotions                                                          */
/* ------------------------------------------------------------------ */

/** Validates a discount code server-side, where a real backend would do it. */
export async function lookupPromotion(code: string) {
  const trimmed = code.trim();
  if (!trimmed) return null;
  return contentService.getPromotionByCode(trimmed);
}

/* ------------------------------------------------------------------ */
/* Bag suggestions                                                     */
/* ------------------------------------------------------------------ */

/**
 * Resolve the products that pair with what is actually in the bag.
 *
 * The bag lives in client state, so the cart page cannot derive this on the
 * server. The links come from the merchant-curated `frequentlyBoughtWithIds`,
 * which is a real editorial relation — unlike a "most bought" rail, it is
 * allowed to describe itself as pairing with these specific products, because
 * it is actually about the products the customer chose.
 */
export async function suggestionsForBag(productIds: string[], limit = 4): Promise<Product[]> {
  const unique = [...new Set(productIds)].slice(0, 20);
  if (unique.length === 0) return [];

  const inBag = await productService.getManyByIds(unique);

  const seen = new Set(unique);
  const paired: Product[] = [];

  for (const product of inBag) {
    const partners = await productService.getFrequentlyBoughtWith(product, limit);
    for (const partner of partners) {
      if (seen.has(partner.id)) continue;
      seen.add(partner.id);
      paired.push(partner);
      if (paired.length >= limit) return paired;
    }
  }

  return paired;
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

/**
 * Places the order.
 *
 * Writes to Postgres through `placeOrderInDatabase`, which re-prices the basket
 * from the variant rows and recomputes every discount — the totals the browser
 * sends are never used. The returned value is a small result, not the order:
 * the confirmation page re-reads the order through the read path, so what the
 * shopper is shown is fetched under the same rules as anybody else's view.
 *
 * When Supabase is not configured this still falls back to the in-memory mock,
 * so `DATA_SOURCE=mock` remains a working checkout for local UI work. The
 * fallback is not reachable in a configured environment.
 */
export type PlaceOrderOutcome =
  | {
      ok: true;
      orderNumber: string;
      accessToken: string;
      /** Whether the confirmation email was actually accepted by the provider. */
      confirmation: { sent: boolean; reason?: string };
    }
  | { ok: false; message: string };

export async function placeOrder(input: CreateOrderInput): Promise<PlaceOrderOutcome> {
  let stored: PlaceOrderResult;

  /*
   * A thrown error from the write path is not caught by the caller.
   *
   * A Server Action that throws tears down the response stream, and the client
   * sees a closed connection: no confirmation, no error, and a shopper who has
   * just entered a card watching a button do nothing. Turning it into a result
   * means the checkout can say what happened.
   *
   * The error is logged rather than returned. The message a shopper sees names
   * the thing they can act on; a database error string could carry a table or
   * column name, and this is a public endpoint.
   */
  try {
    stored = await placeOrderInDatabase(input);
  } catch (error) {
    console.error('placeOrder failed before completing', error);
    return {
      ok: false,
      message: 'We could not record your order. You have not been charged — please try again.',
    };
  }

  if (stored.ok) {
    return {
      ok: true,
      orderNumber: stored.orderNumber,
      accessToken: stored.accessToken,
      // Passed through rather than assumed true. The confirmation page used to
      // say "a confirmation is on its way" unconditionally, which is a claim
      // about a provider this app did not know the state of.
      confirmation: stored.confirmation ?? { sent: false },
    };
  }

  if (isSupabaseConfigured()) {
    // A configured database that refused the order is a real failure. Reporting
    // the mock order here would show a shopper a confirmation for something
    // that was never saved.
    return { ok: false, message: stored.message };
  }

  /*
   * Mock mode: no database, so there is no confirmation page that could verify
   * ownership and nothing to persist to. The order number is returned with an
   * empty token, which the confirmation page treats as "no database to ask",
   * rather than as a failed check.
   */
  const mock = await accountService.createOrder(input);
  return { ok: true, orderNumber: mock.number, accessToken: '', confirmation: { sent: false } };
}

/* ------------------------------------------------------------------ */
/* Newsletter                                                          */
/* ------------------------------------------------------------------ */

export type NewsletterResult = 'subscribed' | 'admin' | 'invalid' | 'unavailable';

/**
 * Signs a visitor up, or routes the reserved address to the admin login.
 *
 * The reserved-address rule is evaluated on the server (see
 * `supabase/newsletter.ts`) and arrives here only as a result code, so the
 * browser cannot skip the check and the address never has to ship in the
 * client bundle.
 *
 * `admin` is a routing instruction, not a grant. It sends the caller to
 * `/admin/login`, where Supabase Auth still requires a password belonging to a
 * row in `admin_users`.
 */
export async function subscribeToNewsletter(email: string, source = 'homepage'): Promise<NewsletterResult> {
  const normalized = email.trim().toLowerCase();

  /*
   * Rate limited before the insert, on the address the visitor typed.
   *
   * The bucket is the address rather than the IP: this endpoint takes no
   * credential, so an IP-keyed limit is trivially sidestepped by a rotating
   * client and only punishes shared networks — a university, an office, a phone
   * carrier. Limiting per address bounds the actual cost, which is one row per
   * distinct value, without that failure mode.
   */
  const limit = await checkRateLimit('newsletter', normalized);
  if (!limit.allowed) {
    // Reported as a plain refusal rather than "invalid", and it does not say the
    // limit is per address, so it cannot be used to confirm an address is new.
    return 'invalid';
  }

  const { status } = await persistSubscription(normalized, source);

  if (status === 'subscribed') {
    /*
     * Welcome mail.
     *
     * Best effort and deliberately not awaited into the result: a subscriber who
     * is on the list but did not get a welcome is fine, and a visitor staring at
     * a spinner because an SMTP connection is slow is not. Every attempt is
     * recorded in `email_log`, including the skipped ones, so "no welcome
     * arrived" is diagnosable rather than silent.
     */
    void welcomeSubscriber(normalized).catch((error: unknown) => {
      console.warn('[newsletter] welcome send failed', error);
    });
  }

  return status;
}

/**
 * Sends the welcome automation with a working unsubscribe link.
 *
 * The token is read on the service role, because migration 0015 removed the
 * anon select on this table. It is never returned to the caller and never
 * logged.
 */
async function welcomeSubscriber(email: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  if (!admin) return;

  const { data } = await admin
    .from('newsletter_subscribers')
    .select('unsubscribe_token')
    .eq('email', email)
    .is('unsubscribed_at', null)
    .maybeSingle<{ unsubscribe_token: string | null }>();

  const origin = await siteOrigin();
  const unsubscribeUrl = origin
    ? `${origin}/newsletter/unsubscribe?token=${encodeURIComponent(data?.unsubscribe_token ?? '')}`
    : '';

  await triggerAutomation(EMAIL_EVENTS.SUBSCRIBER_SUBSCRIBED, email, {
    brand_name: await brandName(),
    unsubscribe_url: unsubscribeUrl,
  });
}
