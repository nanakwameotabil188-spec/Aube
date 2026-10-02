import type { Customer, Order } from '@/types';
import { money } from '@/lib/utils/format';
import { products } from './products';

/**
 * Mock account data.
 *
 * This stands in for an authenticated session and an orders API. The
 * components consuming it are written against the `Customer` and `Order`
 * contracts, so replacing this module with a real auth provider and an
 * `orderService` requires no component changes.
 */

const now = '2026-09-28T09:00:00.000Z';

function line(productId: string, quantity: number, discount = false) {
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error(`Unknown product in mock order: ${productId}`);
  return {
    id: `${productId}-line`,
    productId: product.id,
    variantId: product.variants[0]?.id ?? `${product.id}-v1`,
    name: product.name,
    size: product.size,
    slug: product.slug,
    quantity,
    unitPrice: discount && product.compareAtPrice ? product.compareAtPrice : product.price,
    image: product.thumbnail,
  };
}

export const mockCustomer: Customer = {
  id: 'cus-0001',
  email: 'isabella.marchetti@example.com',
  firstName: 'Isabella',
  lastName: 'Marchetti',
  phone: '+1 (415) 555-0198',
  marketingOptIn: true,
  createdAt: '2025-11-08T09:00:00.000Z',
  addresses: [
    {
      id: 'adr-0001',
      label: 'Home',
      firstName: 'Isabella',
      lastName: 'Marchetti',
      company: '',
      line1: '1847 Fillmore Street',
      line2: 'Apt 3B',
      city: 'San Francisco',
      region: 'CA',
      postalCode: '94115',
      country: 'United States',
      phone: '+1 (415) 555-0198',
      isDefaultShipping: true,
      isDefaultBilling: true,
    },
    {
      id: 'adr-0002',
      label: 'Studio',
      firstName: 'Isabella',
      lastName: 'Marchetti',
      company: 'Marchetti Ceramics',
      line1: '901 Bryant Street',
      line2: 'Unit 12',
      city: 'San Francisco',
      region: 'CA',
      postalCode: '94107',
      country: 'United States',
      phone: '+1 (415) 555-0111',
      isDefaultShipping: false,
      isDefaultBilling: false,
    },
  ],
};

export const mockOrders: Order[] = [
  {
    id: 'ord-0001',
    number: 'AUBE-10428',
    status: 'delivered',
    customerEmail: mockCustomer.email,
    customerName: `${mockCustomer.firstName} ${mockCustomer.lastName}`,
    lines: [
      line('prod-barrier-cream', 1, true),
      line('prod-hydrating-essence', 1),
      line('prod-mineral-shield', 2),
    ],
    discounts: [
      {
        id: 'dsc-1',
        code: 'WELCOME15',
        label: 'First order — 15%',
        type: 'percentage',
        value: 15,
        amount: money(2216),
      },
    ],
    shippingAddress: mockCustomer.addresses[0]!,
    billingAddress: mockCustomer.addresses[0]!,
    shippingMethodId: 'ship-express',
    shippingMethodName: 'Express',
    totals: {
      subtotal: money(18750),
      discountTotal: money(2216),
      shipping: money(1200),
      tax: money(1500),
      total: money(19234),
      freeShippingProgress: 1,
      freeShippingThreshold: money(7500),
    },
    paymentMethodLabel: 'Visa',
    paymentLast4: '4242',
    trackingNumber: '1Z999AA10123456784',
    trackingUrl: 'https://ups.com/track/1Z999AA10123456784',
    placedAt: '2026-08-24T14:22:00.000Z',
    updatedAt: '2026-08-28T11:05:00.000Z',
    timeline: [
      { id: 'tl-1', label: 'Order placed', at: '2026-08-24T14:22:00.000Z', completed: true },
      { id: 'tl-2', label: 'Payment confirmed', at: '2026-08-24T14:23:00.000Z', completed: true },
      { id: 'tl-3', label: 'Dispatched', at: '2026-08-25T09:10:00.000Z', completed: true },
      { id: 'tl-4', label: 'Delivered', at: '2026-08-28T11:05:00.000Z', completed: true },
    ],
  },
  {
    id: 'ord-0002',
    number: 'AUBE-10611',
    status: 'shipped',
    customerEmail: mockCustomer.email,
    customerName: `${mockCustomer.firstName} ${mockCustomer.lastName}`,
    lines: [line('prod-retinal-serum', 1), line('prod-night-repair-cream', 1), line('prod-invisible-fluid-spf', 1)],
    discounts: [],
    shippingAddress: mockCustomer.addresses[0]!,
    billingAddress: mockCustomer.addresses[0]!,
    shippingMethodId: 'ship-standard',
    shippingMethodName: 'Standard',
    totals: {
      subtotal: money(23400),
      discountTotal: money(0),
      shipping: money(0),
      tax: money(1872),
      total: money(25272),
      freeShippingProgress: 1,
      freeShippingThreshold: money(7500),
    },
    paymentMethodLabel: 'Visa',
    paymentLast4: '4242',
    trackingNumber: '9400111899560003847291',
    trackingUrl: 'https://usps.com/track/9400111899560003847291',
    placedAt: '2026-09-22T10:41:00.000Z',
    updatedAt: '2026-09-24T08:15:00.000Z',
    timeline: [
      { id: 'tl-1', label: 'Order placed', at: '2026-09-22T10:41:00.000Z', completed: true },
      { id: 'tl-2', label: 'Payment confirmed', at: '2026-09-22T10:42:00.000Z', completed: true },
      { id: 'tl-3', label: 'Dispatched', at: '2026-09-24T08:15:00.000Z', completed: true },
      { id: 'tl-4', label: 'Delivered', at: '', completed: false },
    ],
  },
  {
    id: 'ord-0003',
    number: 'AUBE-10890',
    status: 'processing',
    customerEmail: mockCustomer.email,
    customerName: `${mockCustomer.firstName} ${mockCustomer.lastName}`,
    lines: [line('prod-vitamin-c-serum', 1, true)],
    discounts: [
      {
        id: 'dsc-2',
        code: 'STACK20',
        label: 'Serum stack — 20%',
        type: 'percentage',
        value: 20,
        amount: money(1840),
      },
    ],
    shippingAddress: mockCustomer.addresses[1]!,
    billingAddress: mockCustomer.addresses[1]!,
    shippingMethodId: 'ship-overnight',
    shippingMethodName: 'Overnight',
    totals: {
      subtotal: money(9200),
      discountTotal: money(1840),
      shipping: money(2400),
      tax: money(617),
      total: money(10377),
      freeShippingProgress: 1,
      freeShippingThreshold: money(7500),
    },
    paymentMethodLabel: 'Amex',
    paymentLast4: '1005',
    placedAt: '2026-09-27T16:58:00.000Z',
    updatedAt: '2026-09-27T16:59:00.000Z',
    timeline: [
      { id: 'tl-1', label: 'Order placed', at: '2026-09-27T16:58:00.000Z', completed: true },
      { id: 'tl-2', label: 'Payment confirmed', at: '2026-09-27T16:59:00.000Z', completed: true },
      { id: 'tl-3', label: 'Preparing your order', at: now, completed: false },
      { id: 'tl-4', label: 'Dispatched', at: '', completed: false },
    ],
  },
  {
    id: 'ord-0004',
    number: 'AUBE-10102',
    status: 'cancelled',
    customerEmail: mockCustomer.email,
    customerName: `${mockCustomer.firstName} ${mockCustomer.lastName}`,
    lines: [line('prod-mineral-clay-mask', 1)],
    discounts: [],
    shippingAddress: mockCustomer.addresses[0]!,
    billingAddress: mockCustomer.addresses[0]!,
    shippingMethodId: 'ship-standard',
    shippingMethodName: 'Standard',
    totals: {
      subtotal: money(4200),
      discountTotal: money(0),
      shipping: money(0),
      tax: money(336),
      total: money(4536),
      freeShippingProgress: 0,
      freeShippingThreshold: money(7500),
    },
    paymentMethodLabel: 'Visa',
    paymentLast4: '4242',
    placedAt: '2026-06-11T12:03:00.000Z',
    updatedAt: '2026-06-12T09:44:00.000Z',
    timeline: [
      { id: 'tl-1', label: 'Order placed', at: '2026-06-11T12:03:00.000Z', completed: true },
      { id: 'tl-2', label: 'Payment confirmed', at: '2026-06-11T12:04:00.000Z', completed: true },
      { id: 'tl-3', label: 'Cancelled at your request', at: '2026-06-12T09:44:00.000Z', completed: true },
    ],
  },
];
