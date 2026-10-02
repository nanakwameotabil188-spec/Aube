import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeading } from '@/components/account/AccountNav';
import { SignOutButton } from '@/components/account/ProfileForm';
import { getAccountCustomer, getAccountOrders, getAccountSession } from '@/lib/supabase/account';
import { routes } from '@/lib/routes';
import { formatDate, formatMoney } from '@/lib/utils/format';

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false, follow: false },
};

/**
 * Account overview.
 *
 * Says what is actually stored. There is no loyalty tier, no spend-this-year
 * figure and no "member since" celebration, because none of those exist in the
 * database — inventing a spend total would be arithmetic on data the shop does
 * not have.
 */
export default async function AccountOverviewPage() {
  const [session, customer, orders] = await Promise.all([
    getAccountSession(),
    getAccountCustomer(),
    getAccountOrders(),
  ]);

  // The layout has already replaced the body for a signed-out visitor; this is
  // the belt to that braces, and it costs nothing.
  if (!session) return null;

  const recent = orders.slice(0, 3);
  // Counted from the real rows, not from a lifetime-spend shortcut that would
  // need a column that does not exist.
  const totalSpent = orders
    .filter((order) => order.status !== 'cancelled' && order.status !== 'refunded')
    .reduce((sum, order) => sum + order.totals.total.amount, 0);

  return (
    <div className="max-w-3xl">
      <AccountHeading
        title="Your account"
        intro={`Signed in as ${customer?.email ?? session.email}.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Orders" value={String(orders.length)} />
        <Stat label="Lifetime spend" value={formatMoney({ amount: totalSpent, currency: 'USD' })} />
        <Stat label="Addresses" value={String(customer?.addresses.length ?? 0)} />
      </div>

      <section className="mt-14">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl text-ink">Recent orders</h2>
          {orders.length > 3 ? (
            <Link href={routes.account.orders} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
              All {orders.length}
            </Link>
          ) : null}
        </div>

        {recent.length === 0 ? (
          <div className="rounded-xs border border-dashed border-line px-6 py-12 text-center">
            <p className="text-md text-ink">No orders yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
              When you place one it will appear here, with its status and everything you bought.
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
            {recent.map((order) => (
              <li key={order.id}>
                <Link
                  href={routes.account.order(order.id)}
                  className="flex items-center gap-4 py-4 transition-colors hover:bg-sand"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{order.number}</p>
                    <p className="text-xs text-muted">
                      {formatDate(order.placedAt)} · {order.lines.length}{' '}
                      {order.lines.length === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                  <StatusPill status={order.status} />
                  <span className="shrink-0 text-sm tabular-nums text-ink">
                    {formatMoney(order.totals.total)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-14 border-t border-line pt-8">
        <SignOutButton />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xs bg-sand px-5 py-4">
      <p className="text-xs uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums text-ink">{value}</p>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  processing: 'bg-sand text-ink',
  shipped: 'bg-moss-soft text-moss',
  delivered: 'bg-moss-soft text-moss',
  cancelled: 'bg-danger-soft text-danger',
  refunded: 'bg-danger-soft text-danger',
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`hidden shrink-0 rounded-full px-2.5 py-1 text-xs capitalize sm:inline-block ${
        STATUS_TONE[status] ?? 'bg-sand text-muted'
      }`}
    >
      {status}
    </span>
  );
}
