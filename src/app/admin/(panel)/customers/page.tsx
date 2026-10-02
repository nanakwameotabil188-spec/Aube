import { formatMoney, money } from '@/lib/utils/format';
import { getAdminStatus, listAdminCustomers } from '@/lib/supabase/admin-data';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { AdminGate } from '@/components/admin/AdminGate';

export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function AdminCustomersPage() {
  return (
    <AdminGate>
      <CustomersScreen />
    </AdminGate>
  );
}

async function CustomersScreen() {
  const status = getAdminStatus();
  if (!status.ready) return <AdminEmpty reason={status.reason} detail={status.detail} />;

  const customers = await listAdminCustomers();
  if (!customers) {
    return <AdminEmpty reason="No connection" detail="The service role client is unavailable." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted">
          {customers.length} most recent {customers.length === 1 ? 'customer' : 'customers'}
        </p>
      </div>

      {customers.length === 0 ? (
        <p className="rounded-lg border border-line bg-shell p-6 text-sm text-muted">
          No customers yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-shell">
          <table className="w-full min-w-[38rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.14em] text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Orders</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Spend</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{customer.full_name}</td>
                  <td className="px-4 py-3 text-muted">{customer.email}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(customer.created_at)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {customer.order_count}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(money(customer.spend))}
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
