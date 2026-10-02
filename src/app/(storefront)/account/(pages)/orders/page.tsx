import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeading } from '@/components/account/AccountNav';
import { getAccountOrders, getAccountSession } from '@/lib/supabase/account';
import { routes } from '@/lib/routes';
import { formatDate, formatMoney } from '@/lib/utils/format';

export const metadata: Metadata = {
  title: 'Your orders',
  robots: { index: false, follow: false },
};

/**
 * Order history.
 *
 * Reads through the cookie-scoped client, so RLS decides which rows appear. The
 * page holds no filter of its own: adding one would only narrow what the
 * database already decided.
 */
export default async function AccountOrdersPage() {
  const [session, orders] = await Promise.all([getAccountSession(), getAccountOrders()]);

  if (!session) return null;

  return (
    <div className="max-w-3xl">
      <AccountHeading
        title="Your orders"
        intro="Everything you have ordered, newest first. Orders placed before you created an account are matched to it by the email address you used."
      />

      {orders.length === 0 ? (
        <div className="rounded-xs border border-dashed border-line px-6 py-12 text-center">
          <p className="text-md text-ink">No orders yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            When you place an order it will appear here with its status, what was in it, and where it went.
          </p>
          <Link
            href={routes.shop}
            className="mt-6 inline-block rounded-md bg-ink px-5 py-2.5 text-sm text-porcelain transition-colors hover:bg-ink-soft"
          >
            Browse the shop
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={routes.account.order(order.id)}
                className="flex items-center gap-4 py-5 transition-colors hover:bg-sand"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{order.number}</p>
                  <p className="text-xs text-muted">
                    {formatDate(order.placedAt)} · {order.lines.length}{' '}
                    {order.lines.length === 1 ? 'item' : 'items'}
                    {order.shippingMethodName ? ` · ${order.shippingMethodName}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm capitalize text-muted">{order.status}</span>
                <span className="shrink-0 text-sm tabular-nums text-ink">{formatMoney(order.totals.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
