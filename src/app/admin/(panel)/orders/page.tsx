import { formatMoney, money } from '@/lib/utils/format';
import { getAdminStatus, listAdminOrders } from '@/lib/supabase/admin-data';
import { allowedTransitions } from '@/lib/supabase/order-fulfilment';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { AdminGate } from '@/components/admin/AdminGate';
import { OrderStatusControl } from '@/components/admin/OrderStatusControl';
import { StatusPill } from '@/components/admin/StatusPill';

export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function AdminOrdersPage() {
  return (
    <AdminGate>
      <OrdersScreen />
    </AdminGate>
  );
}

async function OrdersScreen() {
  const status = getAdminStatus();
  if (!status.ready) return <AdminEmpty reason={status.reason} detail={status.detail} />;

  const orders = await listAdminOrders();
  if (!orders) {
    return <AdminEmpty reason="No connection" detail="The service role client is unavailable." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted">
          {orders.length} most recent {orders.length === 1 ? 'order' : 'orders'}. Moving an order
          updates its timeline, notifies the shopper and sends the matching email.
        </p>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-lg border border-line bg-shell p-6 text-sm text-muted">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-shell">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.14em] text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Order</th>
                <th scope="col" className="px-4 py-3 font-medium">Placed</th>
                <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Items</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                <th scope="col" className="px-4 py-3 font-medium">Move to</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="px-4 py-3 font-medium tabular-nums">{order.number}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(order.placed_at)}</td>
                  <td className="px-4 py-3 text-muted">{order.customer_email}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={order.status} />
                    {order.payment_method_label && order.payment_method_label !== 'Card' ? (
                      <p className="mt-1 text-xs text-muted">{order.payment_method_label}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{order.line_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(money(order.total))}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusControl
                      orderId={order.id}
                      status={order.status}
                      allowed={allowedTransitions(order.status)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
