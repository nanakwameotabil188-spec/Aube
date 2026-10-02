'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ShippingMethod, StoreSettings } from '@/types';
import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/format';
import { routes } from '@/lib/routes';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { OrderSummary } from '@/components/commerce/Cart';
import { EmptyState } from '@/components/ui/states';
import { useCart } from '@/store/cart-context';
import { useToast } from '@/store/toast-context';
import { placeOrder as submitOrder } from '@/lib/actions';

/**
 * Checkout.
 *
 * Three steps, one column, with the order summary always visible beside them.
 *
 * ## The payment step describes the real configuration
 *
 * No gateway charge is implemented, so today nothing is ever collected. The
 * wording is not hardcoded here: `gateway` is resolved on the server from what an
 * admin actually chose under Integrations, so "not configured", "bank transfer"
 * and a stored-but-unimplemented key all say something different and none of them
 * claim a card was charged.
 *
 * Card fields stay in the form for the gateway integration that will replace
 * them, and they are sent nowhere — only the last four digits would be retained,
 * and only when a provider actually charges. Submitting validates, records a real
 * order, and says plainly that nothing was charged.
 */

const STEPS = ['Contact', 'Delivery', 'Payment'] as const;
type Step = (typeof STEPS)[number];

export interface CheckoutGateway {
  collectsPayment: boolean;
  label: string;
  shopperNotice: string | null;
}

const COUNTRIES = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Ireland', 'France', 'Germany', 'Japan'];

interface FormState {
  email: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
  methodId: string;
  notes: string;
  cardName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
}

type FieldName = keyof FormState;
type Errors = Partial<Record<FieldName, string>>;

const INITIAL: FormState = {
  email: '',
  firstName: '',
  lastName: '',
  address1: '',
  address2: '',
  city: '',
  postcode: '',
  country: 'United States',
  phone: '',
  methodId: '',
  notes: '',
  cardName: '',
  cardNumber: '',
  cardExpiry: '',
  cardCvc: '',
};

export function CheckoutFlow({
  settings,
  shippingMethods,
  gateway,
}: {
  settings: StoreSettings;
  shippingMethods: ShippingMethod[];
  gateway: CheckoutGateway;
}) {
  const router = useRouter();
  const { cart, isEmpty, shippingMethod, setShippingMethod, clear, ready } = useCart();
  const { notify } = useToast();

  const [step, setStep] = useState<Step>('Contact');
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [placing, setPlacing] = useState(false);
  /** A refusal from the server, shown above the pay button. */
  const [placedError, setPlacedError] = useState<string | null>(null);

  const set = <K extends FieldName>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const stepIndex = STEPS.indexOf(step);

  const selectedMethodId = form.methodId || shippingMethod?.id;
  const method = useMemo(
    () => shippingMethods.find((item) => item.id === selectedMethodId) ?? shippingMethods[0] ?? null,
    [selectedMethodId, shippingMethods],
  );

  /**
   * Validation runs per step, so the shopper is only ever shown errors for
   * fields they can actually see and fix.
   */
  const validate = (target: Step): boolean => {
    const next: Errors = {};

    if (target === 'Contact') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) next.email = 'Enter a valid email address';
      if (!form.firstName.trim()) next.firstName = 'Required';
      if (!form.lastName.trim()) next.lastName = 'Required';
    }

    if (target === 'Delivery') {
      if (!form.address1.trim()) next.address1 = 'Required';
      if (!form.city.trim()) next.city = 'Required';
      if (!form.postcode.trim()) next.postcode = 'Required';
    }

    if (target === 'Payment') {
      if (form.cardName.trim().length < 2) next.cardName = 'Name on card is required';
      if (form.cardNumber.replace(/\D/g, '').length < 12) next.cardNumber = 'Enter a card number';
      if (!/^\d{2}\s*\/\s*\d{2}$/.test(form.cardExpiry)) next.cardExpiry = 'MM / YY';
      if (!/^\d{3,4}$/.test(form.cardCvc)) next.cardCvc = '3 or 4 digits';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const advance = () => {
    if (!validate(step)) return;
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const placeOrder = async () => {
    if (!validate('Payment') || !method) return;
    if (shippingMethod?.id !== method.id) setShippingMethod(method);

    setPlacing(true);
    setPlacedError(null);
    try {
      const result = await submitOrder({
        email: form.email,
        shippingAddress: {
          firstName: form.firstName,
          lastName: form.lastName,
          line1: form.address1,
          line2: form.address2 || undefined,
          city: form.city,
          postalCode: form.postcode,
          country: form.country,
          phone: form.phone || undefined,
        },
        shippingMethodId: method.id,
        shippingMethodName: method.name,
        lines: cart.lines,
        discounts: cart.discounts,
        totals: cart.totals,
        // Only the last four digits are retained. A full PAN must never reach
        // the storefront, the order record, or a log line.
        paymentLast4: form.cardNumber.replace(/\D/g, '').slice(-4) || undefined,
      });

      /*
       * The server re-prices the basket, so a rejection here is a real refusal
       * — stock ran out, a product was withdrawn, the order number collided.
       * The bag is deliberately NOT cleared: the order does not exist, and
       * emptying someone's bag because the shop said no loses their work.
       */
      if (!result.ok) {
        setPlacedError(result.message);
        notify(result.message, { tone: 'error' });
        return;
      }

      clear();
      notify(
        gateway.collectsPayment
          ? `Order ${result.orderNumber} confirmed`
          : `Order ${result.orderNumber} received — nothing has been charged`,
        { tone: 'success' },
      );

      /*
       * The confirmation page reads the email outcome back out of the database
       * rather than being told it here. It is the only copy that must be true
       * — "a confirmation is on its way" is a claim about a third-party send —
       * and `email_log` is the record that decides it. Pasting the result into
       * the URL would mean trusting a value the shopper's browser controls.
       */
      router.push(routes.checkoutConfirmation(result.orderNumber, result.accessToken));
    } finally {
      setPlacing(false);
    }
  };

  if (ready && isEmpty) {
    return (
      <EmptyState
        icon="cart"
        title="There is nothing to check out"
        body="Your bag is empty. Add something first and we will pick up where you left off."
        action={{ label: 'Shop all products', href: routes.shop }}
        className="py-24"
      />
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
      <section aria-label="Checkout">
        <ol className="mb-10 flex flex-wrap items-center gap-x-3 gap-y-2">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => index < stepIndex && setStep(label)}
                disabled={index > stepIndex}
                aria-current={label === step ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 text-sm transition-colors',
                  index <= stepIndex ? 'text-ink' : 'text-muted-light',
                  index < stepIndex && 'hover:text-moss',
                )}
              >
                <span
                  className={cn(
                    'grid size-6 place-items-center rounded-full text-2xs tabular-nums',
                    index < stepIndex
                      ? 'bg-ink text-shell'
                      : index === stepIndex
                        ? 'border border-ink text-ink'
                        : 'border border-line text-muted',
                  )}
                >
                  {index < stepIndex ? <Icon name="check" size={11} aria-hidden /> : index + 1}
                </span>
                {label}
              </button>
              {index < STEPS.length - 1 && <span aria-hidden className="h-px w-6 bg-line-strong" />}
            </li>
          ))}
        </ol>

        {step === 'Contact' && (
          <fieldset className="flex flex-col gap-5">
            <legend className="sr-only">Contact details</legend>
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(event) => set('email', event.target.value)}
              autoComplete="email"
              error={errors.email}
              hint="Order confirmation and tracking go here."
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="First name"
                value={form.firstName}
                onChange={(event) => set('firstName', event.target.value)}
                autoComplete="given-name"
                error={errors.firstName}
              />
              <Input
                label="Last name"
                value={form.lastName}
                onChange={(event) => set('lastName', event.target.value)}
                autoComplete="family-name"
                error={errors.lastName}
              />
            </div>

            <Input
              label="Phone"
              optional
              type="tel"
              value={form.phone}
              onChange={(event) => set('phone', event.target.value)}
              autoComplete="tel"
              hint="Only used for delivery questions."
            />
          </fieldset>
        )}

        {step === 'Delivery' && (
          <fieldset className="flex flex-col gap-5">
            <legend className="sr-only">Delivery address</legend>
            <Input
              label="Address"
              value={form.address1}
              onChange={(event) => set('address1', event.target.value)}
              autoComplete="address-line1"
              error={errors.address1}
            />
            <Input
              label="Apartment, suite"
              optional
              value={form.address2}
              onChange={(event) => set('address2', event.target.value)}
              autoComplete="address-line2"
            />

            <div className="grid gap-5 sm:grid-cols-3">
              <Input
                label="City"
                value={form.city}
                onChange={(event) => set('city', event.target.value)}
                autoComplete="address-level2"
                error={errors.city}
              />
              <Input
                label="Postcode"
                value={form.postcode}
                onChange={(event) => set('postcode', event.target.value)}
                autoComplete="postal-code"
                error={errors.postcode}
              />
              <Select
                label="Country"
                value={form.country}
                onChange={(event) => set('country', event.target.value)}
                options={COUNTRIES.map((country) => ({ value: country, label: country }))}
              />
            </div>

            <fieldset className="mt-2">
              <legend className="eyebrow-tight mb-3 text-muted">Delivery method</legend>
              <div className="flex flex-col gap-2">
                {shippingMethods.map((item) => (
                  <label
                    key={item.id}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-4 rounded-xs border px-4 py-3.5 transition-colors',
                      selectedMethodId === item.id ? 'border-ink bg-shell' : 'border-line hover:border-ink',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shipping-method"
                        value={item.id}
                        checked={selectedMethodId === item.id}
                        onChange={() => set('methodId', item.id)}
                        className="size-4 accent-ink"
                      />
                      <span>
                        <span className="block text-sm font-medium text-ink">{item.name}</span>
                        <span className="block text-xs text-muted">{item.estimate}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-ink">
                      {item.price.amount === 0 ? 'Free' : formatMoney(item.price)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Textarea
              label="Delivery notes"
              optional
              value={form.notes}
              onChange={(event) => set('notes', event.target.value)}
              rows={3}
              hint="Gate codes, safe place — anything the courier should know."
            />
          </fieldset>
        )}

        {step === 'Payment' && (
          <fieldset className="flex flex-col gap-5">
            <legend className="sr-only">Payment</legend>
            <p className="flex items-start gap-2.5 rounded-xs bg-sand px-4 py-3 text-sm leading-relaxed text-ink">
              <Icon name="info" size={15} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                {gateway.shopperNotice ??
                  'A payment gateway is connected. Card details are collected below and never stored by this shop.'}
              </span>
            </p>

            <Input
              label="Name on card"
              value={form.cardName}
              onChange={(event) => set('cardName', event.target.value)}
              autoComplete="cc-name"
              error={errors.cardName}
            />
            <Input
              label="Card number"
              value={form.cardNumber}
              onChange={(event) => set('cardNumber', groupDigits(event.target.value, 4))}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4242 4242 4242 4242"
              error={errors.cardNumber}
              maxLength={19}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                label="Expiry"
                value={form.cardExpiry}
                onChange={(event) => set('cardExpiry', formatExpiry(event.target.value))}
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM / YY"
                error={errors.cardExpiry}
                maxLength={7}
              />
              <Input
                label="Security code"
                value={form.cardCvc}
                onChange={(event) => set('cardCvc', event.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                error={errors.cardCvc}
                maxLength={4}
              />
            </div>
          </fieldset>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6">
          {placedError ? (
            <p
              role="alert"
              className="w-full rounded-xs border border-line bg-danger-soft px-4 py-3 text-sm text-danger"
            >
              {placedError}
            </p>
          ) : null}
          {stepIndex > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const previous = STEPS[stepIndex - 1];
                if (previous) setStep(previous);
              }}
            >
              Back
            </Button>
          )}
          {step === 'Payment' ? (
            <Button type="button" onClick={placeOrder} disabled={placing} size="lg">
              {placing
                ? 'Placing order…'
                : // "Pay" is a claim that money moves. With no gateway connected it
                  // does not, and a button that says otherwise is the same
                  // dishonesty as recording the order as paid.
                  gateway.collectsPayment
                  ? `Pay ${formatMoney(cart.totals.total)}`
                  : `Place order · ${formatMoney(cart.totals.total)}`}
            </Button>
          ) : (
            <Button type="button" onClick={advance}>
              Continue to {STEPS[stepIndex + 1]}
            </Button>
          )}
        </div>
      </section>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <OrderSummary lines={cart.lines} totals={cart.totals} settings={settings} showShipping={false} />
      </aside>
    </div>
  );
}

function groupDigits(value: string, size: number): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.match(new RegExp(`.{1,${size}}`, 'g'))?.join(' ') ?? digits;
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}
