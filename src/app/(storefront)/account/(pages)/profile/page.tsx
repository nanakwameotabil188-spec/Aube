import type { Metadata } from 'next';
import { AccountHeading } from '@/components/account/AccountNav';
import { ProfileForm } from '@/components/account/ProfileForm';
import { getAccountCustomer, getAccountSession } from '@/lib/supabase/account';

export const metadata: Metadata = {
  title: 'Your details',
  robots: { index: false, follow: false },
};

/**
 * Profile editing.
 *
 * Renders only what the `customers` row holds. There is no marketing-consent
 * toggle here, because there is no consent column: showing one that writes
 * nothing would be a control that lies about what the shop has recorded.
 */
export default async function AccountProfilePage() {
  const [session, customer] = await Promise.all([getAccountSession(), getAccountCustomer()]);

  if (!session) return null;

  return (
    <div className="max-w-2xl">
      <AccountHeading
        title="Your details"
        intro="Used on your orders and for delivery messages. Nothing here is shared or sold."
      />

      <ProfileForm
        firstName={customer?.firstName ?? ''}
        lastName={customer?.lastName ?? ''}
        phone={customer?.phone ?? ''}
        email={customer?.email ?? session.email}
        emailConfirmed={session.emailConfirmed}
      />

      {customer?.addresses.length ? (
        <section className="mt-14 border-t border-line pt-8">
          <h2 className="font-display text-xl text-ink">Addresses on file</h2>
          <ul className="mt-5 flex flex-col gap-4">
            {customer.addresses.map((address) => (
              <li key={address.id} className="rounded-xs border border-line px-5 py-4 text-sm leading-relaxed">
                <address className="not-italic text-muted">
                  {address.firstName} {address.lastName}
                  <br />
                  {address.line1}
                  {address.line2 ? (
                    <>
                      <br />
                      {address.line2}
                    </>
                  ) : null}
                  <br />
                  {address.city}, {address.postalCode}
                  <br />
                  {address.country}
                </address>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
