import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Session refresh.
 *
 * Supabase sessions are short-lived JWTs that the client is expected to renew.
 * Without a refresh somewhere in the request path, an admin who leaves a tab
 * open is silently signed out and the next save fails with a message about
 * authorisation rather than about the session. `getUser()` performs that
 * renewal as a side effect, so calling it is enough.
 *
 * It is also the only place that can *write* the session cookie: a Server
 * Component may read cookies but not set them, and the Server Action behind
 * the sign-in form runs on its own request. The response is rebuilt after each
 * `setAll` so the refreshed token actually reaches the browser.
 *
 * This deliberately does not authorise anything. It refreshes credentials;
 * whether they grant admin access is decided in `getAdminAuth`, against the
 * `admin_users` table, on every request.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function proxy(request: NextRequest) {
  // Unconfigured: pass straight through. The admin pages report the missing
  // credentials themselves, and a throw here would take down the storefront
  // for a problem that only affects the panel.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        // Rebuilt rather than mutated: NextResponse cookies are immutable once
        // the response is sealed.
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation output. The
     * storefront pages do not read the session, but they are included
     * deliberately: an admin previewing the shop is signed in too, and
     * refreshing there keeps the cookie fresh without a second rule.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|txt|xml)$).*)',
  ],
};
