import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { AccountHeading } from '@/components/account/AccountNav';
import { getAccountOrder, getAccountSession } from '@/lib/supabase/account';
import { routes } from '@/lib/routes';
import { formatDate, formatMoney } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = {
  title: 'Order',
  robots: { index: false, follow: false },
};

type Params = { params: Promise<{ id: string }> };

/**
 * One order, for the signed-in owner.
 *
 * Addressed by the order's uuid, not its number, and read through the
 * cookie-scoped client so RLS refuses anyone else's. A wrong id is a 404 rather
 * than a 403: a 403 would confirm that the order exists.
 */
export default async function AccountOrderPage({ params }: Params) {
  const { id } = await params;
  const [session, order] = await Promise.all([getAccountSession(), getAccountOrder(id)]);

  if (!session) return null;
  if (!order) notFound();

  return (
    <div className="max-w-3xl">
      <p className="mb-6">
        <Link href={routes.account.orders} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
          ← All orders
        </Link>
      </p>

      <AccountHeading title={`Order ${order.number}`} intro={`Placed ${formatDate(order.placedAt)}.`} />

      <section className="rounded-xs bg-sand p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted">Progress</h2>
        {order.timeline.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No status has been recorded for this order yet.</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-3">
            {order.timeline.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    entry.completed ? 'bg-moss' : 'border border-line-strong bg-shell',
                  )}
                />
                <span className="flex flex-1 flex-col">
                  <span className={cn('text-sm', entry.completed ? 'text-ink' : 'text-muted')}>
                    {entry.label}
                  </span>
                  <span className="text-xs text-muted-light">{formatDate(entry.at)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-12">
        <h2 className="mb-4 font-display text-xl text-ink">Items</h2>
        <ul className="divide-y divide-line border-y border-line">
          {order.lines.map((line) => (
            <li key={line.id} className="flex items-center gap-4 py-4">
              {line.image.url ? (
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xs bg-sand">
                  <Image src={line.image.url} alt="" fill sizes="64px" className="object-cover" />
                </div>
              ) : (
                <div className="size-16 shrink-0 rounded-xs bg-sand" />
              )}
              <div className="min-w-0 flex-1">
                {/*
                  An order line stores a name, not a slug. A product that has
                  since been renamed or withdrawn still has to render, so this is
                  plain text rather than a link that might 404.
                */}
                <p className="truncate text-sm font-medium text-ink">{line.name}</p>
                <p className="text-xs text-muted">
                  {line.size} · Qty {line.quantity}
                </p>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-ink">
                {formatMoney({
                  amount: line.unitPrice.amount * line.quantity,
                  currency: line.unitPrice.currency,
                })}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-6 flex flex-col gap-2 text-sm">
          <Row label="Subtotal" value={formatMoney(order.totals.subtotal)} />
          {order.totals.discountTotal.amount > 0 ? (
            <Row label="Discount" value={`−${formatMoney(order.totals.discountTotal)}`} />
          ) : null}
          <Row
            label="Shipping"
            value={order.totals.shipping.amount === 0 ? 'Free' : formatMoney(order.totals.shipping)}
          />
          <Row label="Tax" value={formatMoney(order.totals.tax)} />
          <div className="mt-2 flex items-baseline justify-between border-t border-ink pt-3">
            <dt className="font-display text-lg text-ink">Total</dt>
            <dd className="font-display text-lg tabular-nums text-ink">{formatMoney(order.totals.total)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-12 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-xl text-ink">Delivering to</h2>
          <address className="text-sm not-italic leading-relaxed text-muted">
            {order.customerName}
            <br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? (
              <>
                <br />
                {order.shippingAddress.line2}
              </>
            ) : null}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.postalCode}
            <br />
            {order.shippingAddress.country}
          </address>
        </div>

        <div>
          <h2 className="mb-3 font-display text-xl text-ink">Payment</h2>
          <p className="text-sm leading-relaxed text-muted">
            {order.paymentMethodLabel}
            {order.paymentLast4 ? ` ending ${order.paymentLast4}` : ''}
            {order.shippingMethodName ? (
              <>
                <br />
                {order.shippingMethodName}
              </>
            ) : null}
          </p>
        </div>
      </section>
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
