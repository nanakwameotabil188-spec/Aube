import type { Metadata } from 'next';
import { RegisterForm } from '@/components/account/AccountForms';

export const metadata: Metadata = {
  title: 'Create an account',
  robots: { index: false, follow: false },
};

type Search = { next?: string | string[] };

export default async function AccountRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const value = (await searchParams).next;
  const next = Array.isArray(value) ? value[0] : value;

  return (
    <div className="container-page py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <p className="eyebrow">Your account</p>
        <h1 className="mt-3 font-display text-3xl text-ink sm:text-4xl">Create an account</h1>
        <p className="mt-4 text-md leading-relaxed text-muted">
          Keeps your orders in one place. We will email a link to confirm your address, and you can buy
          without an account at any time.
        </p>

        <RegisterForm next={next} />
      </div>
    </div>
  );
}
