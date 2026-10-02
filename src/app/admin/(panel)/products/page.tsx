import Link from 'next/link';
import { formatMoney, money } from '@/lib/utils/format';
import { getAdminStatus, listAdminProducts } from '@/lib/supabase/admin-data';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { AdminGate } from '@/components/admin/AdminGate';
import { ProductVisibilityToggle } from '@/components/admin/ProductVisibilityToggle';
import { Pagination } from '@/components/ui/states';

export const dynamic = 'force-dynamic';

const PER_PAGE = 20;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  return (
    <AdminGate>
      <ProductsScreen searchParams={searchParams} />
    </AdminGate>
  );
}

async function ProductsScreen({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const status = getAdminStatus();
  if (!status.ready) return <AdminEmpty reason={status.reason} detail={status.detail} />;

  const params = await searchParams;
  const query = params.q ?? '';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const result = await listAdminProducts({ search: query, page, perPage: PER_PAGE });
  if (!result) {
    return <AdminEmpty reason="No connection" detail="The service role client is unavailable." />;
  }

  const { rows, total } = result;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-muted">
            {total} {total === 1 ? 'product' : 'products'}
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-md bg-ink px-4 py-2 text-sm text-porcelain transition-colors hover:bg-ink-soft"
        >
          New product
        </Link>
      </div>

      <form role="search" className="flex gap-2">
        <label htmlFor="admin-product-search" className="sr-only">
          Search products
        </label>
        <input
          id="admin-product-search"
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name or slug"
          className="w-full max-w-md rounded-md border border-line bg-shell px-3 py-2 text-sm outline-none focus:border-line-strong"
        />
        <button
          type="submit"
          className="rounded-md border border-line bg-shell px-4 py-2 text-sm transition-colors hover:border-line-strong"
        >
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-line bg-shell p-6 text-sm text-muted">
          {query ? 'No products match that search.' : 'No products yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-shell">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-[0.14em] text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Product</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Price</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Stock</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${row.id}`} className="font-medium hover:text-moss">
                      {row.name}
                    </Link>
                    <p className="text-xs text-muted">/{row.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <ProductVisibilityToggle id={row.id} name={row.name} visible={row.visible} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(money(row.price))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={
                        row.stock_quantity === 0
                          ? 'text-danger'
                          : row.stock_quantity <= 5
                            ? 'text-warning'
                            : undefined
                      }
                    >
                      {row.stock_quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/products/${row.id}`}
                      className="text-muted underline underline-offset-4 hover:text-ink"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 ? (
        <Pagination
          page={page}
          totalPages={pageCount}
          buildHref={(n) => `/admin/products?${new URLSearchParams({ q: query, page: String(n) })}`}
        />
      ) : null}
    </div>
  );
}
