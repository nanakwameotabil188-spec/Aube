import type { ReactNode } from 'react';
import { AccountNav } from '@/components/account/AccountNav';
import { NotificationBell } from '@/components/account/NotificationBell';
import { listNotifications } from '@/lib/supabase/notifications';
import { getAccountSession } from '@/lib/supabase/account';

/**
 * Layout for the pages that require a session.
 *
 * Gated once here so no page beneath has to repeat the check — and, more
 * importantly, so none of them can forget it. A signed-out visitor sees the
 * sign-in panel rather than an account page that renders successfully with no
 * data, which would be indistinguishable from an account that genuinely has no
 * orders.
 */
export default async function AccountPagesLayout({ children }: { children: ReactNode }) {
  /*
   * Read here rather than inside `AccountNav`, which is where the bell is
   * rendered, so the notifications are fetched once per navigation instead of
   * once per component that happens to want them.
   *
   * Returns nothing for a signed-out visitor: `listNotifications` goes through
   * the public client and RLS resolves the recipient from the session, so there
   * is nothing to fetch and no error to swallow.
   */
  const [session, notifications] = await Promise.all([
    getAccountSession(),
    listNotifications(15),
  ]);

  return (
    <AccountNav bell={session ? <NotificationBell initial={notifications} /> : null}>
      {children}
    </AccountNav>
  );
}
