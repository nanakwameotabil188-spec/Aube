import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { accountService } from '@/lib/services/content-service';
import { getOrderForConfirmation, getAccountSession } from '@/lib/supabase/account';
import { confirmationDeliveredTo } from '@/lib/supabase/notifications';
import { routes } from '@/lib/routes';
import { formatDate, formatMoney } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Icon } from '@/components/ui/Icon';
import { LinkButton } from '@/components/ui/Button';
import { Notice } from '@/components/ui/states';
import { ProductRail } from '@/components/commerce/ProductCard';
import { productService } from '@/lib/services/catalog-service';

export const metadata: Metadata = {
  title: 'Order confirmed',
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
};

/**
 * Order confirmation.
 *
 * Says the three things a shopper actually needs to know: that the order went
 * through, what it cost, and when it will arrive. The timeline is rendered
 * from the order's own record, so it stays truthful as the order progresses.
 *
 * ## Access
 *
 * This page is not reachable by order number alone. Numbers are a prefix plus a
 * short sequence, so anyone could walk `AUBE-10430`, `AUBE-10431`, … and read a
 * stranger's address and order. Two things are required instead: a signed-in
 * shopper is matched on ownership through RLS, and a guest must present the
 * `access_token` minted when the order was placed. `notFound()` — rather than a
 * 403 — is deliberate, so a wrong token does not confirm that the order exists.
 */
export default async function ConfirmationPage({ params, searchParams }: Params) {
  const { orderNumber } = await params;
  const { t } = await searchParams;
  const number = decodeURIComponent(orderNumber);
  const token = typeof t === 'string' ? t : null;

  const session = await getAccountSession();

  /*
   * The database is authoritative whenever it is configured.
   *
   * The mock is used only when there is no database at all. A *refused* lookup
   * returns `{ configured: true, order: null }` and must not fall through to the
   * mock, or the order number would be sufficient to read any order — which is
   * the one thing the access token exists to prevent.
   */
  const found = await getOrderForConfirmation(number, token, { signedIn: session != null });

  const order = found.configured ? found.order : await accountService.getOrderById(number);
  if (!order) notFound();

  const recommendations = await productService.getByFlags('isBestSeller', 6);
  const address = order.shippingAddress;

  /*
   * Whether to promise an email.
   *
   * Only asked when the order came from the database: the mock has no mail
   * stack, so it can never have sent anything and the honest answer there is
   * simply not to make a claim either way.
   */
  const delivery = found.configured
    ? await confirmationDeliveredTo(order.customerEmail)
    : { sent: false, reason: 'unknown' as const };

  return (
    <div className="container-page py-12 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-moss text-shell">
            <Icon name="check" size={24} aria-hidden />
          </span>
          <div>
            <p className="eyebrow mb-3">Order {order.number}</p>
            <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">Thank you</h1>
<p className="mt-4 text-md leading-relaxed text-muted">
              {/*
                Says what was actually sent, rather than asserting a confirmation
                is on its way. The three cases have different follow-up advice:
                one is "wait", one is "we will fix the provider", and one is
                "here is the order anyway".
              */}
              {delivery.sent ? (
                <>
                  A confirmation has been sent to{' '}
                  <span className="text-ink">{order.customerEmail}</span>. We will email tracking as
                  soon as it leaves us.
                </>
              ) : (
                <>
                  Your order is saved. We could not send a confirmation to{' '}
                  <span className="text-ink">{order.customerEmail}</span> right now — keep this
                  page for your reference, and we will email you when it ships.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-8">
          <section className="rounded-xs bg-sand p-6 sm:p-8">
            <h2 className="font-display text-xl text-ink">What happens next</h2>
            <ol className="mt-5 flex flex-col gap-4">
              {order.timeline.map((entry, index) => (
                <li key={entry.id} className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1 size-2.5 shrink-0 rounded-full',
                      entry.completed ? 'bg-moss' : 'border border-line-strong bg-shell',
                    )}
                  />
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className={cn('text-sm', entry.completed ? 'text-ink' : 'text-muted')}>{entry.label}</span>
                    <span className="text-xs text-muted-light">
                      {index === 0 ? formatDate(entry.at) : 'Pending'}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="mb-4 font-display text-xl text-ink">Delivering to</h2>
            <address className="text-sm not-italic leading-relaxed text-muted">
              {order.customerName}
              <br />
              {address.line1}
              {address.line2 && (
                <>
                  <br />
                  {address.line2}
                </>
              )}
              <br />
              {address.city}, {address.postalCode}
              <br />
              {address.country}
            </address>
            <p className="mt-3 text-sm text-muted">
              {order.shippingMethodName}
              {order.paymentLast4 && ` · Card ending ${order.paymentLast4}`}
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-display text-xl text-ink">Your order</h2>
            <ul className="divide-y divide-line border-y border-line">
              {order.lines.map((line) => (
                <li key={line.id} className="flex items-center gap-4 py-4">
                  <Link
                    href={routes.product(line.slug)}
                    className="relative size-16 shrink-0 overflow-hidden rounded-xs bg-sand"
                  >
                    <Image src={line.image.url} alt="" fill sizes="64px" className="object-cover" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={routes.product(line.slug)}
                      className="block truncate text-sm font-medium text-ink transition-colors hover:text-moss"
                    >
                      {line.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {line.size} · Qty {line.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-ink">
                    {formatMoney({ amount: line.unitPrice.amount * line.quantity, currency: line.unitPrice.currency })}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-5 flex flex-col gap-2 text-sm">
              <Row label="Subtotal" value={formatMoney(order.totals.subtotal)} />
              {order.totals.discountTotal.amount > 0 && (
                <Row label="Discount" value={`−${formatMoney(order.totals.discountTotal)}`} />
              )}
              <Row label="Shipping" value={order.totals.shipping.amount === 0 ? 'Free' : formatMoney(order.totals.shipping)} />
              <Row label="Tax" value={formatMoney(order.totals.tax)} />
              <div className="mt-2 flex items-baseline justify-between border-t border-ink pt-3">
                <dt className="font-display text-lg text-ink">Total</dt>
                <dd className="font-display text-lg tabular-nums text-ink">{formatMoney(order.totals.total)}</dd>
              </div>
            </dl>
          </section>

          {/*
   * Shown from the order's own status rather than asserted unconditionally.

   * The order write path records `'paid'` only when a provider genuinely
   * collected money, so this notice disappears on its own the day a gateway that
   * actually charges is connected — no copy edit to remember, and no window
   * where the page claims a payment was refused after it succeeded.
   */}
          {order.status !== 'paid' ? (
            <Notice tone="info">
              No payment has been taken for this order
              {order.paymentMethodLabel && order.paymentMethodLabel !== 'Not collected'
                ? ` — it will be settled by ${order.paymentMethodLabel.toLowerCase()}`
                : ''}
              . Your order is saved and stays open until payment is arranged.
            </Notice>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <LinkButton href={routes.shop} size="lg">
              Continue shopping
            </LinkButton>
            <LinkButton href={routes.wishlist} variant="secondary" size="lg">
              View saved items
            </LinkButton>
          </div>
        </div>
      </div>

      {recommendations.length > 0 && (
        <section className="mt-24 border-t border-line pt-16">
          {/*
            Curated, not measured. These come from a merchandising flag, so
            calling them the most-bought would be a sales claim the data cannot
            support — we do not aggregate orders here.
          */}
          <h2 className="mb-8 font-display text-2xl text-ink sm:text-3xl">
            Worth adding to your routine
          </h2>
          <ProductRail products={recommendations} />
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  );
}

