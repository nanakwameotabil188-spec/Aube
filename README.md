# AUBE

A premium skincare storefront built on the Next.js App Router, with a data layer
that runs either from in-repo content or from Supabase Postgres, and a
protected admin panel for managing the catalogue.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # optional for the mock source
npm run dev
```

With no `DATA_SOURCE` set the app runs on the in-repo catalogue and needs no
network access. Flip `DATA_SOURCE=supabase` and fill in the credentials to run
against Postgres.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` / `npm run typecheck` | ESLint and `tsc --noEmit` |
| `npm run audit:overflow` | Flags horizontal overflow at 5 viewport widths |
| `npm run audit:interactions` | Drives cart, wishlist, and search in a headless browser |
| `npm run audit:newsletter` | Measures signup text contrast and checkbox visibility on all three surfaces |
| `npm run smoke:admin` | Signs in through the real admin form and walks the panel |
| `npm run smoke:newsletter` | Drives both newsletter paths and checks what landed in the database |
| `npm run db:migrate` | Applies `supabase/migrations/*.sql`, tracking what ran |
| `npm run db:seed` | Loads the mock catalogue into Postgres (idempotent) |
| `npm run db:check` | Verifies RLS: what anon can and cannot read and write |
| `npm run db:storage` | Verifies both buckets, MIME limits, and size limits |
| `npm run db:status` | Row counts, RLS coverage, and bucket configuration |
| `npm run db:admin -- <email> "<password>" "<name>"` | Creates an admin account |
| `npm run db:admin -- --delete <email>` | Removes an admin account and its auth user |
| `npm run db:setup` | `migrate` → `seed` → `check` → `storage` |

## Data sources

`src/lib/services/` is the only layer allowed to read `src/data/`. It talks to
a repository chosen at runtime, and both implement the same interface:

| `DATA_SOURCE` | Repository | Behaviour |
| --- | --- | --- |
| `mock` | `repositories/mock-catalog.ts` | In-repo content, no network |
| `supabase` | `repositories/supabase-catalog.ts` | Postgres, falling back to mock when unconfigured |

The two are swappable without touching a single call site, so a page cannot
accidentally reach for the wrong data source.

**Client components cannot import the Supabase modules.** They are marked
`server-only`, which turns a stray import into a build failure rather than a
leaked key in the browser bundle. Anything a client needs to read or write goes
through a server action in `src/app/*/actions.ts` or `src/lib/actions/`.

## Public vs. authenticated access

| | Client | Key | Reads cookies |
| --- | --- | --- | --- |
| Public catalogue | `createPublicSupabaseClient()` | anon | No |
| Server + admin | `createServerSupabaseClient()` | anon | Yes |
| Admin writes | `createAdminSupabaseClient()` | service role | No |

Public reads use a stateless client so they can be cached and shared across
requests. Cookie access is reserved for paths that genuinely need a session.

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. It must never reach the
browser, and admin mutations must authorise the caller against `admin_users`
on the server — a role sent from the client is not evidence of anything.

## Admin panel

`/admin/login` is a standalone page that deliberately sits outside the panel
chrome, so a failed sign-in does not flash a half-rendered shell. Every route
under `/admin/(panel)` re-checks the session server-side.

Sections: overview, products, media, reviews, orders, customers, subscribers,
homepage, onboarding, messaging, email, integrations, and settings.

There is no shipped admin account. Create the one you want with your own
credentials:

```bash
npm run db:admin -- you@example.com "<a password you chose>" "Your Name"
```

`npm run smoke:admin` needs that account, and reads the address and password
from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env.local`.

## Newsletter

One signup form exists, in the `sec-newsletter` home section. The footer used to
carry a second, promotional copy of the same form on every page; it is removed,
along with the `newsletter` prop it threaded through `StorefrontShell` and the
storefront layout.

The form takes a `tone` prop (`light` | `dark`) because it renders on both. The
homepage section is the dark `bg-ink` band, while the FAQ and Journal callouts
sit on light page backgrounds, and text colour inherits from the section — a
single style set made the typed value white-on-white on the homepage. Every
colour is set explicitly per tone rather than inherited.

A signup writes to `newsletter_subscribers` through the **anon** client. That is
the point, not a limitation: an anon insert is exactly what the
`anyone may subscribe` policy allows, so the signup path holds no credential
capable of anything else. The table is write-only from the public side — no
select, update, or delete — and the service role is reserved for the admin read,
where RLS would otherwise hide the list.

| Address | Result |
| --- | --- |
| Any other address | Stored, with the normal success message |
| `shopaurai@gmail.com` | **Not** stored; routes to `/admin/login` |

The reserved address is a routing rule, not a credential. The comparison happens
on the server (`src/lib/supabase/newsletter.ts`) and only a result code reaches
the browser, so the address never ships in the client bundle and cannot be
skipped. Arriving at `/admin/login` grants nothing: Supabase Auth still requires
a password belonging to a live `admin_users` row. The comparison is
case-insensitive, because email is and because an exact match would make the
trigger depend on how the address happened to be typed.

`npm run smoke:newsletter` drives both paths through the real form and asserts
against the database rather than the UI, because a form that renders "you are on
the list" without storing anything is exactly the bug this originally had.

Media uploads go to one of two buckets:

| Bucket | Public | Limit |
| --- | --- | --- |
| `public` | Yes | 8 MiB |
| `admin-private` | No | 8 MiB |

The limit is enforced by the bucket as well as the client, so a crafted request
cannot bypass it.

## Payment is not connected, and the shop says so everywhere

No payment gateway charge is implemented. Stripe, PayPal and Razorpay credentials
can be stored and encrypted, but nothing charges a card, and the storefront does
not pretend otherwise in any of the four places it would be tempting:

| Where | What it says |
| --- | --- |
| Checkout, payment step | Wording comes from `paymentGatewayState()` — never hardcoded |
| The submit button | "Place order", not "Pay", when no gateway collects |
| `orders.status` | `pending`, not `processing` — nothing was settled |
| `orders.payment_method_label` | "Not collected" or "Bank transfer", not "Card" |
| `payment_last4` | Not stored at all unless a provider actually charges |
| Order timeline | "Order received — awaiting payment" |

`paymentGatewayState()` in `src/lib/supabase/integrations.ts` is the single
place that decides. Every provider is `collectsPayment: false`, which is the
accurate description of the codebase, so the first gateway that genuinely
charges is a one-line change in the provider catalogue rather than an audit of
every place an order status is written.

Turning a stored-but-unimplemented key into a working charge flow is a real piece
of work, and the picker says so rather than letting an operator infer it from a
Stripe key being present.

## Email

Every email goes through one path, `sendMail`, which logs every attempt —
including the ones that did not happen. A "skipped" row in `email_log` records
that an automation was disabled or no provider is configured, which is the
difference between "the confirmation never arrived" and "it was never attempted".

| Provider | Status |
| --- | --- |
| Log only | Full. Renders to the server log; nothing leaves the machine |
| Resend | Full. Plain HTTPS, no SDK |
| Postmark | Full. Plain HTTPS, no SDK |
| SMTP | Not implemented — see the comment in `src/lib/mail/providers.ts` |

Six automations fire from real triggers: `user.signup`,
`user.password_reset`, `order.placed`, `order.dispatched`, `order.delivered`
and `subscriber.subscribed`. Each maps to an editable template under
Admin → Email, so the copy can be changed without a deploy.

### Signup verification

The account is created **unconfirmed** and this app sends its own confirmation
link, rather than letting the auth provider send one. The reason is that
otherwise the one email in the shop an operator cannot edit, cannot disable, and
cannot see a delivery log for is the signup confirmation.

The password goes straight from the form to `createUser` and is never stored
anywhere this app controls — verification confirms the *user*, it does not
create one, so there is no pending-signup table holding a password between the
form and the click.

Only a SHA-256 of the token is stored, so a database dump cannot be walked to
confirm arbitrary addresses. "Verified before signing in" is enforced in the
sign-in action, which is the only place it is load-bearing: an unconfirmed user
cannot obtain a session at all.

**When no email provider is configured**, registration falls back to the auth
provider's own email rather than refusing outright. An unconfigured shop that
cannot create accounts is a worse failure than a rate-limited email, and the
operator is told which path was taken.

## Rate limiting

Fixed-window counters in `rate_limit_counters`, incremented by one atomic
statement (`consume_rate_limit`), so several instances agree. Applied to
registration, sign-in, password reset, verification resend and newsletter
signup.

The limiter **fails open**: if the counter table is unreachable it allows the
request and logs why. A limiter that takes the site down when the database
hitches has caused a bigger outage than the abuse it prevents.

Buckets are keyed on the submitted address rather than the IP for the
unauthenticated form actions. Those endpoints hold no credential, so an IP-keyed
limit is trivially sidestepped by a rotating client while punishing shared
networks — an office, a university, a carrier.

## Order fulfilment

Orders move through a transition table, enforced server-side in
`src/lib/supabase/order-fulfilment.ts`:

```
pending → paid → processing → shipped → delivered
   └──────────┴───────────┴──→ cancelled
```

The admin panel renders only the moves the current status permits. One status
change appends a timeline row, sends the shopper an in-app notification, and
fires the matching email — in that order, so a mail failure can never leave the
panel disagreeing with the customer. Cancelling is the only transition that
touches inventory, and it puts the reserved stock back through
`restore_variant_stock` (0016) rather than by reusing the decrement with a
negative quantity, which would invert its floor test.

## Security headers

Set in `next.config.ts`: CSP, `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`, and HSTS in production only.

The CSP keeps `'unsafe-inline'` for scripts and says why in the file: nonce-based
CSP requires reading headers in middleware, which makes every route dynamic and
costs the statically prerendered catalogue. That trade should be made
deliberately, with the cost measured, not as a surprise in a header change.

## Security model

- Row-level security is enabled on every table, verified by `npm run db:check`.
  Anonymous callers see published catalogue and content rows only; `admin_users`,
  `reviews`, `orders`, `customers`, and non-brand `settings` return zero rows,
  and unauthorised writes are rejected.
- Service-role access is confined to `src/lib/supabase/admin.ts` and gated
  behind an `admin_users` lookup.
- Provider secrets are encrypted at rest with AES-256-GCM
  (`src/lib/supabase/crypto.ts`) under a key that lives only in the environment.
  There is no read path that returns a plaintext secret — the admin form shows a
  masked fingerprint, so the page HTML never contains a live credential.
- Content is honest. Ratings, reviews, testimonials, rankings, and clinical
  claims are absent rather than invented; empty states render as empty states.

## Layout

```
src/app/(storefront)/    customer-facing routes
src/app/admin/           login + (panel) routes
src/lib/services/        data access, repository selection
src/lib/supabase/        clients, mappers, admin helpers, storage
src/lib/actions/         server actions for client components
src/data/                mock catalogue (service layer only)
supabase/migrations/     numbered, applied in order, tracked
scripts/                 db setup, policy checks, headless-browser audits
```

## Notes for deployment

- Set `DATA_SOURCE=supabase` in the deployment environment. Leaving it on
  `mock` will serve the in-repo catalogue and never touch the database.
- The `smoke:*` and `audit:*` scripts expect a server on `http://localhost:4310`
  (`npx next start -p 4310`) and drive a headless Edge via the DevTools
  protocol. `smoke:admin` additionally needs an admin account, so it is the
  only one that fails on a fresh setup.
- `tests/notifications.spec.ts` creates and deletes its own shopper, so it needs
  no admin password. The three admin specs do need `ADMIN_EMAIL` and
  `ADMIN_PASSWORD`.
- Sign-in makes several sequential network calls, so the pending state can last
  several seconds on a slow link. The tests wait accordingly.
- Set `SECRET_ENCRYPTION_KEY` (at least 32 characters) before storing provider
  credentials. Admin → Integrations explains the requirement and refuses to
  write a secret without it, rather than falling back to plaintext.
