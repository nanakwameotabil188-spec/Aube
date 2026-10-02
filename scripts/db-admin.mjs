import { Client } from 'pg';
import { loadEnvFile } from './lib/env.mjs';

/**
 * Creates or updates the first admin account.
 *
 * The row has to exist in two places: Supabase Auth (which owns the session
 * and the password) and `admin_users` (which the RLS `is_admin()` helper reads).
 * Creating only the auth user leaves someone who can sign in but is refused by
 * every policy; creating only the admin row leaves a role nobody can use.
 *
 * Idempotent: re-running promotes the same account rather than creating a
 * second one. Passing a password again *does* reset it, which is what makes this
 * the way to rotate a credential that has been exposed. Omitting it on a later
 * run is a no-op rather than a silent password change.
 *
 * That distinction is the whole point of the `password` argument being
 * optional. Earlier this script only ever set a password at creation, so
 * `npm run db:admin -- you@example.com "a new password"` on an account that
 * already existed did nothing at all and still reported success — which is the
 * worst possible behaviour for the one command somebody reaches for after a
 * credential leaks. Resetting an existing password is now explicit.
 *
 * Pass --delete to remove an account. The `admin_users` row goes first: if the
 * auth delete then fails, the leftover is an auth user with no admin row,
 * which RLS refuses everywhere. The reverse order would leave a row pointing at
 * a user who no longer exists.
 *
 * Usage:
 *   npm run db:admin -- you@example.com "A password you chose" "Full Name" [editor|admin]
 *   npm run db:admin -- --delete you@example.com
 */

loadEnvFile();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const directUrl = process.env.DIRECT_URL;

if (!url || !serviceRole || !directUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or DIRECT_URL.');
  process.exit(1);
}

const args = process.argv.slice(2);
const deleting = args[0] === '--delete';
const [email, password, fullName, role = 'admin'] = deleting ? args.slice(1) : args;

if (!email) {
  console.error(
    deleting
      ? 'Usage: npm run db:admin -- --delete <email>'
      : 'Usage: npm run db:admin -- <email> [password] [full name] [role]',
  );
  process.exit(1);
}

async function findExistingUser() {
  const response = await fetch(
    `${url}/auth/v1/admin/users?page=1&per_page=200`,
    { headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` } },
  );
  if (!response.ok) return null;

  const { users } = await response.json();
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function createUser() {
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || 'AUBE Admin' },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`auth: ${response.status} ${body}`);
  }

  return response.json();
}

async function setPassword(userId) {
  const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    },
    // `email_confirm` is carried over so resetting a password on an unconfirmed
    // account does not silently leave it unusable for sign-in.
    body: JSON.stringify({ password, email_confirm: true }),
  });

  if (!response.ok) {
    throw new Error(`auth password update: ${response.status} ${await response.text()}`);
  }
}

async function deleteAuthUser(userId) {
  const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
  });
  // 404 means it is already gone, which is the outcome we wanted anyway.
  if (!response.ok && response.status !== 404) {
    throw new Error(`auth delete: ${response.status} ${await response.text()}`);
  }
  return response.status !== 404;
}

async function main() {
  const client = new Client({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    if (deleting) {
      const existing = await findExistingUser();
      const { rowCount } = await client.query(
        'delete from admin_users where lower(email) = lower($1) returning user_id',
        [email],
      );

      if (rowCount === 0 && !existing) {
        console.log(`no account for ${email} — nothing to delete.`);
        return;
      }

      console.log(`admin_users: removed ${rowCount} row(s)`);

      if (existing) {
        const removed = await deleteAuthUser(existing.id);
        console.log(`auth user: ${removed ? 'deleted' : 'already absent'}`);
      } else {
        console.log('auth user: no matching auth account, left untouched');
      }
      return;
    }

    const existing = await findExistingUser();
    let userId;
    let passwordReset = false;

    if (existing) {
      userId = existing.id;
      // Only touch the password when one was actually supplied, so an ordinary
      // re-run to change a role cannot log the owner out of their own account.
      if (password) {
        await setPassword(userId);
        passwordReset = true;
      }
    } else {
      userId = (await createUser()).id;
    }

    console.log(`auth user: ${existing ? 'found' : 'created'} (${userId})`);
    if (passwordReset) console.log('auth user: password reset');

    // Upsert rather than insert, so a re-run promotes an existing editor to
    // admin instead of failing on the primary key.
    await client.query(
      `insert into admin_users (user_id, email, full_name, role, active)
       values ($1, $2, $3, $4, true)
       on conflict (user_id) do update set
         email      = excluded.email,
         full_name  = excluded.full_name,
         role       = excluded.role,
         active     = true,
         updated_at = now()`,
      [userId, email, fullName || 'AUBE Admin', role],
    );

    console.log(`admin_users: upserted as ${role}`);

    if (!existing) {
      console.log(`\nsign in at /admin with ${email} and the password you passed.`);
      console.log('Change it immediately — the value above was set over the wire.');
    } else if (passwordReset) {
      console.log(`\nThe old password for ${email} no longer works. Any session it had open`);
      console.log('is still valid until it expires; sign the account out everywhere if the');
      console.log('credential leaked rather than being rotated as routine hygiene.');
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
