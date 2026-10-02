import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/account/AccountForms';

export const metadata: Metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="container-page py-16 sm:py-24">
      <div className="mx-auto max-w-md">
        <p className="eyebrow">Your account</p>
        <h1 className="mt-3 font-display text-3xl text-ink sm:text-4xl">Reset your password</h1>
        <p className="mt-4 text-md leading-relaxed text-muted">
          Enter the address on your account and we will send a link to set a new one.
        </p>

        <ForgotPasswordForm />
      </div>
    </div>
  );
}
