'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAdminAuth } from '@/lib/supabase/admin-auth';

/**
 * Admin sign-in and sign-out.
 *
 * `signInWithPassword` runs server-side so the password is posted straight to
 * Supabase and the session cookie is set by the Server Action's own request —
 * the one request in this app where cookies are writable.
 *
 * The error is returned rather than thrown, because a wrong password is an
 * ordinary outcome of a form, not an exception. The distinction that matters
 * is deliberate: the message never says whether the address exists.
 */

export interface SignInResult {
  ok: boolean;
  message: string;
}

function asString(value: FormDataEntryValue | null, max = 200): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

export async function signIn(
  _prev: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const email = asString(formData.get('email'));
  const password = asString(formData.get('password'), 200);

  if (!email || !password) {
    return { ok: false, message: 'Enter your email address and password.' };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { ok: false, message: 'Supabase is not configured, so signing in is unavailable.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Deliberately vague: distinguishing "no such account" from "wrong
    // password" turns the form into a way to enumerate who works here.
    return { ok: false, message: 'That email address and password do not match an account.' };
  }

  /*
   * Signing in successfully is not the same as being allowed in. The session
   * alone grants nothing — the role lives in `admin_users` — so the check runs
   * here as well as on every protected page, and a non-admin is signed straight
   * back out rather than shown an empty panel.
   */
  const auth = await getAdminAuth();

  if (!auth.authenticated) {
    await supabase.auth.signOut();

    if (auth.reason === 'not_authorised') {
      return {
        ok: false,
        message: 'That account is not an administrator. Ask the owner to add it.',
      };
    }
    return { ok: false, message: 'Signed in, but the administrator check failed. Try again.' };
  }

  // Outside the try/catch on purpose: `redirect` signals control flow by
  // throwing, and swallowing that would leave the form on screen as though
  // nothing happened.
  redirect('/admin');
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  if (supabase) await supabase.auth.signOut();
  redirect('/admin/login');
}
