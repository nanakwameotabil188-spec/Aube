'use client';

import { useState } from 'react';
import { inputClass } from './fields';

/**
 * Size/variant editor.
 *
 * Skincare is sold in sizes far more often than in colours: 30ml, 50ml, and a
 * travel size at a different price each. Stock lives on the variant, not the
 * product, so this is where a size gets its own SKU, price, and count.
 *
 * Rows are controlled state rather than hidden inputs. Controlled inputs still
 * submit their `name`, and a repeater that can add, remove, and reorder needs
 * to know the order it is in.
 */

interface VariantDraft {
  key: string;
  sku: string;
  name: string;
  size: string;
  price: string;
  compareAtPrice: string;
  stockQuantity: string;
  isDefault: boolean;
}

const BLANK: Omit<VariantDraft, 'key'> = {
  sku: '',
  name: '',
  size: '',
  price: '',
  compareAtPrice: '',
  stockQuantity: '0',
  isDefault: false,
};

let counter = 0;
const nextKey = () => `v${++counter}`;

export function VariantEditor({
  variants,
  productId,
  onChange,
}: {
  /** Raw `product_variants` rows; converted to the editable shape below. */
  variants: {
    id: string;
    sku: string;
    name: string;
    size: string;
    price: number;
    compare_at_price: number | null;
    stock_quantity: number;
    is_default: boolean;
  }[];
  productId?: string;
  onChange: (next: VariantDraft[]) => void;
}) {
  const [rows, setRows] = useState<VariantDraft[]>(() =>
    variants.length > 0
      ? variants.map((variant) => ({
          key: variant.id,
          sku: variant.sku,
          name: variant.name,
          size: variant.size,
          price: (variant.price / 100).toFixed(2),
          compareAtPrice:
            variant.compare_at_price != null ? (variant.compare_at_price / 100).toFixed(2) : '',
          stockQuantity: String(variant.stock_quantity),
          isDefault: variant.is_default,
        }))
      : [],
  );

  function update(next: VariantDraft[]) {
    setRows(next);
    onChange(next);
  }

  function patch(index: number, changes: Partial<VariantDraft>) {
    update(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const source = next[index];
    const destination = next[target];
    if (!source || !destination) return;
    next[index] = destination;
    next[target] = source;
    update(next);
  }

  function makeDefault(index: number) {
    update(rows.map((row, i) => ({ ...row, isDefault: i === index })));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted">
          One row per size. Leave empty if this product is sold in a single size — the product-level
          price and stock are used instead.
        </p>
        <button
          type="button"
          onClick={() => update([...rows, { ...BLANK, key: nextKey() }])}
          className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-sand"
        >
          Add size
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No sizes. The product is sold in one size.
        </p>
      ) : null}

      {rows.map((row, index) => (
        <div key={row.key} className="rounded-md border border-line bg-shell p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="text-xs font-medium">SKU</span>
              <input
                name={`variant_sku_${index}`}
                value={row.sku}
                onChange={(event) => patch(index, { sku: event.target.value })}
                placeholder="AUBE-CRM-50"
                className={`${inputClass} mt-1`}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium">Label</span>
              <input
                name={`variant_name_${index}`}
                value={row.name}
                onChange={(event) => patch(index, { name: event.target.value })}
                placeholder="Standard"
                className={`${inputClass} mt-1`}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium">Size</span>
              <input
                name={`variant_size_${index}`}
                value={row.size}
                onChange={(event) => patch(index, { size: event.target.value })}
                placeholder="50 ml"
                className={`${inputClass} mt-1`}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium">Stock</span>
              <input
                name={`variant_stock_${index}`}
                type="number"
                min="0"
                step="1"
                value={row.stockQuantity}
                onChange={(event) => patch(index, { stockQuantity: event.target.value })}
                className={`${inputClass} mt-1`}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium">Price</span>
              <input
                name={`variant_price_${index}`}
                type="number"
                min="0"
                step="0.01"
                value={row.price}
                onChange={(event) => patch(index, { price: event.target.value })}
                className={`${inputClass} mt-1`}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium">Compare at</span>
              <input
                name={`variant_compare_${index}`}
                type="number"
                min="0"
                step="0.01"
                value={row.compareAtPrice}
                onChange={(event) => patch(index, { compareAtPrice: event.target.value })}
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`variant_default_${index}`}
                checked={row.isDefault}
                onChange={() => makeDefault(index)}
                className="size-4 accent-moss"
              />
              Default size
            </label>

            <span className="flex-1" />

            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={`Move ${row.size || row.name || `size ${index + 1}`} up`}
              className="rounded-md border border-line px-2 py-1 text-xs disabled:opacity-40"
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={index === rows.length - 1}
              aria-label={`Move ${row.size || row.name || `size ${index + 1}`} down`}
              className="rounded-md border border-line px-2 py-1 text-xs disabled:opacity-40"
            >
              Down
            </button>
            <button
              type="button"
              onClick={() => update(rows.filter((_, i) => i !== index))}
              className="rounded-md border border-danger px-2 py-1 text-xs text-danger"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {rows.length > 0 ? (
        <input type="hidden" name="variant_count" value={rows.length} />
      ) : null}
      {productId ? <input type="hidden" name="id" value={productId} /> : null}
    </div>
  );
}
