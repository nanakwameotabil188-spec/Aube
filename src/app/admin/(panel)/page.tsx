import Link from 'next/link';
import { formatMoney, money } from '@/lib/utils/format';
import { getAdminStatus, getOverview, listAdminOrders } from '@/lib/supabase/admin-data';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { AdminGate } from '@/components/admin/AdminGate';
import { StatusPill } from '@/components/admin/StatusPill';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  return (
    <AdminGate>
      <OverviewScreen />
    </AdminGate>
  );
}

async function OverviewScreen() {
  const status = getAdminStatus();
  if (!status.ready) return <AdminEmpty reason={status.reason} detail={status.detail} />;

  const [overview, orders] = await Promise.all([getOverview(), listAdminOrders(8)]);
  if (!overview) return <AdminEmpty reason="No connection" detail="The service role client is unavailable." />;

  const stats = [
    { label: 'Products', value: String(overview.products), href: '/admin/products' },
    { label: 'Visible', value: String(overview.visibleProducts), href: '/admin/products' },
    { label: 'Orders', value: String(overview.orders), href: '/admin/orders' },
    { label: 'Open orders', value: String(overview.openOrders), href: '/admin/orders' },
    { label: 'Customers', value: String(overview.customers), href: '/admin/customers' },
    // `total` is minor units, same as `Money.amount`.
    { label: 'Revenue', value: formatMoney(money(overview.revenue)), href: '/admin/orders' },
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="admin-stats">
        <h1 id="admin-stats" className="text-xl font-semibold tracking-tight">
          Overview
        </h1>

        <dl className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-line bg-shell p-4">
              <dt className="text-xs uppercase tracking-[0.14em] text-muted">{stat.label}</dt>
              <dd className="mt-1.5 text-xl font-semibold tabular-nums">
                <Link href={stat.href} className="hover:text-moss">
                  {stat.value}
                </Link>
              </dd>
            </div>
          ))}
        </dl>

        {overview.lowStock > 0 || overview.outOfStock > 0 ? (
          <p className="mt-4 text-sm text-muted">
            {overview.outOfStock > 0 ? (
              <>
                <strong className="font-medium text-danger">{overview.outOfStock}</strong> out of stock
                {overview.lowStock > 0 ? ' and ' : '. '}
              </>
            ) : null}
            {overview.lowStock > 0 ? (
              <>
                <strong className="font-medium text-warning">{overview.lowStock}</strong> at or below
                the low-stock threshold
              </>
            ) : null}
            .
          </p>
        ) : null}
      </section>

      <section aria-labelledby="admin-recent-orders">
        <h2 id="admin-recent-orders" className="text-lg font-semibold tracking-tight">
          Recent orders
        </h2>

        {orders && orders.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.14em] text-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">Order</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Customer</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Items</th>
                  <th scope="col" className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-line/60">
                    <td className="py-2.5 pr-4 font-medium tabular-nums">{order.number}</td>
                    <td className="py-2.5 pr-4 text-muted">{order.customer_email}</td>
                    <td className="py-2.5 pr-4">
                      <StatusPill status={order.status} />
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted">
                      {order.line_count}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatMoney(money(order.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">No orders yet.</p>
        )}
      </section>
    </div>
  );
}
