import type { Money, Orderable } from '@/types';

const formatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string) {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    });
    formatters.set(currency, formatter);
  }
  return formatter;
}

/** Minor units → localised currency string. */
export function formatMoney(money: Money): string {
  return currencyFormatter(money.currency).format(money.amount / 100);
}

export function money(amount: number, currency: Money['currency'] = 'USD'): Money {
  return { amount: Math.round(amount), currency };
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateLong(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** "3 days ago" / "in 2 months" — used by journal and review metadata. */
export function formatRelative(value: string, now = new Date()): string {
  const then = new Date(value);
  const days = Math.round((then.getTime() - now.getTime()) / 86_400_000);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(days) < 30) return formatter.format(days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return formatter.format(months, 'month');
  return formatter.format(Math.round(months / 12), 'year');
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function discountPercent(price: Money, compareAt?: Money): number | null {
  if (!compareAt || compareAt.amount <= price.amount) return null;
  return Math.round((1 - price.amount / compareAt.amount) * 100);
}
