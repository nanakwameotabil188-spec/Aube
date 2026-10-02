-- =============================================================================
-- 0010_integrations.sql
--
-- Where payment and email providers are configured, and the automation that
-- sends email.
--
-- ## Why these are not in `settings`
--
-- The obvious place for this was the existing `settings` key/value table,
-- which already holds the brand name and the storefront copy. That would have
-- been wrong. `settings` is read by the public storefront through an anon
-- client, so a gateway secret written there would be readable by anyone who
-- opened the browser devtools. An API key in a table the public can read is an
-- API key that has leaked.
--
-- So this is a separate table with no anon policy at all. The only reader is
-- the service role, on the server.
--
-- ## The secrets are encrypted at rest, not just hidden
--
-- RLS keeps the anonymous public out, but "hidden from the web" is not the
-- same as "safe": a leaked service-role key, a stray SQL dump, or a backup on
-- somebody's laptop would still expose a live gateway secret in plaintext.
-- `secrets_ciphertext` holds AES-256-GCM ciphertext whose key is supplied by an
-- environment variable and never stored in the database. A database dump on its
-- own is therefore inert.
--
-- Encryption is applied in the application, not by pgcrypto, because the key
-- has to come from the deployment environment. That means this column is opaque
-- to SQL and cannot be selected usefully by anyone but the server.
--
-- ## Reading a secret back is deliberately impossible
--
-- There is no select path that returns a plaintext secret. The admin form shows
-- a masked value (`sk_live_...7f3a`) computed from the stored ciphertext, and
-- writing replaces the whole blob. Nobody needs the original: every provider
-- call is made server-side.
-- =============================================================================

create table if not exists integrations (
  id                 text primary key
                       check (id in ('payments', 'email')),
  provider           text        not null default 'none',
  -- Encrypted JSON. Null when no secret has been stored yet.
  secrets_ciphertext text,
  -- Non-secret settings: live/test mode, from-address, sender name. Safe to
  -- read, and separated so that showing the form never has to decrypt anything.
  config             jsonb       not null default '{}'::jsonb,
  enabled            boolean     not null default false,
  updated_by         uuid references auth.users (id) on delete set null,
  updated_at         timestamptz not null default now()
);

comment on table integrations is
  'Payment and email provider configuration. Secrets are encrypted at rest and readable only by the server.';
comment on column integrations.secrets_ciphertext is
  'AES-256-GCM ciphertext (iv:tag:data, base64). Never returned to a client.';

-- Admin-only. No anon policy exists, so `authenticated` without an `admin_users`
-- row gets nothing either.
alter table integrations enable row level security;

drop policy if exists "admins read integrations" on integrations;
create policy "admins read integrations"
  on integrations for select
  using (is_admin());

-- Only an admin, not merely an editor, may change a live integration. An editor
-- who can rewrite the payment gateway key is an editor who can redirect money.
drop policy if exists "admins manage integrations" on integrations;
create policy "admins manage integrations"
  on integrations for all
  using (is_admin('admin'))
  with check (is_admin('admin'));


-- -----------------------------------------------------------------------------
-- Email templates
-- -----------------------------------------------------------------------------
-- Bodies use {{placeholder}} tokens rather than a template language. The
-- substitution is done in one small function that only replaces keys the caller
-- already knows about, so a customer-supplied string containing {{...}} cannot
-- cause it to pull in values it was not given.
create table if not exists email_templates (
  key        text primary key
              check (key ~ '^[a-z0-9_]{1,60}$'),
  subject    text        not null,
  body_html  text        not null default '',
  body_text  text        not null default '',
  -- A disabled template is kept but not sent, which is what an operator wants
  -- when they are mid-edit: the text is not lost by turning it off.
  enabled    boolean     not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table email_templates enable row level security;

drop policy if exists "admins read email templates" on email_templates;
create policy "admins read email templates"
  on email_templates for select
  using (is_admin());

drop policy if exists "admins manage email templates" on email_templates;
create policy "admins manage email templates"
  on email_templates for all
  using (is_admin('admin'))
  with check (is_admin('admin'));


-- -----------------------------------------------------------------------------
-- Email automations
-- -----------------------------------------------------------------------------
-- The event to template mapping. Separated from the templates themselves so an
-- operator can silence "order dispatched" without touching "order confirmed",
-- and so adding a trigger does not mean editing an email.
create table if not exists email_automations (
  event        text primary key
                check (event ~ '^[a-z0-9_.]{1,60}$'),
  template_key text        not null references email_templates (key) on delete restrict,
  enabled      boolean     not null default true,
  updated_at   timestamptz not null default now()
);

alter table email_automations enable row level security;

drop policy if exists "admins read email automations" on email_automations;
create policy "admins read email automations"
  on email_automations for select
  using (is_admin());

drop policy if exists "admins manage email automations" on email_automations;
create policy "admins manage email automations"
  on email_automations for all
  using (is_admin('admin'))
  with check (is_admin('admin'));


-- =============================================================================
-- Seed data
--
-- `on conflict do nothing` so re-running the migration does not overwrite copy an
-- operator has since edited. Seeding is a starting point, not a reset.
-- =============================================================================

insert into email_templates (key, subject, body_html, body_text) values
  (
    'signup_verification',
    'Confirm your {{brand_name}} account',
    '<p>Hello{{first_name}},</p><p>Confirm your address to finish creating your {{brand_name}} account.</p><p><a href="{{confirm_url}}">Confirm my email address</a></p><p>This link expires in {{expires_in}} hours. If you did not ask for an account, you can ignore this message.</p>',
    'Hello {{first_name}},' || chr(10) || chr(10) ||
    'Confirm your address to finish creating your {{brand_name}} account:' || chr(10) || chr(10) ||
    '{{confirm_url}}' || chr(10) || chr(10) ||
    'This link expires in {{expires_in}} hours. If you did not ask for an account, you can ignore this message.'
  ),
  (
    'password_reset',
    'Reset your {{brand_name}} password',
    '<p>A password reset was requested for your account.</p><p><a href="{{reset_url}}">Choose a new password</a></p><p>This link expires in {{expires_in}} hours. If you did not ask for it, nothing has changed and you can ignore this message.</p>',
    'A password reset was requested for your account:' || chr(10) || chr(10) ||
    '{{reset_url}}' || chr(10) || chr(10) ||
    'This link expires in {{expires_in}} hours. If you did not ask for it, nothing has changed and you can ignore this message.'
  ),
  (
    'order_confirmation',
    'Your {{brand_name}} order {{order_number}}',
    '<p>Thank you{{first_name}}. We have your order.</p><p><strong>Order {{order_number}}</strong><br>{{order_date}}<br>Total {{order_total}}</p><p>We will email you again when it ships.</p>',
    'Thank you{{first_name}}. We have your order.' || chr(10) || chr(10) ||
    'Order {{order_number}} — {{order_date}}' || chr(10) ||
    'Total {{order_total}}' || chr(10) || chr(10) ||
    'We will email you again when it ships.'
  ),
  (
    'order_dispatched',
    'Your {{brand_name}} order has shipped',
    '<p>Order {{order_number}} is on its way.</p><p>You can follow it in your account.</p>',
    'Order {{order_number}} is on its way. You can follow it in your account.'
  ),
  (
    'order_delivered',
    'Your {{brand_name}} order was delivered',
    '<p>Order {{order_number}} is marked as delivered. We hope you like it.</p>',
    'Order {{order_number}} is marked as delivered. We hope you like it.'
  ),
  (
    'newsletter_welcome',
    'Welcome to {{brand_name}}',
    '<p>Thanks for subscribing. We will email you when there is something worth reading, and not otherwise.</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>',
    'Thanks for subscribing. We will email you when there is something worth reading, and not otherwise.' || chr(10) || chr(10) ||
    'Unsubscribe: {{unsubscribe_url}}'
  )
on conflict (key) do nothing;

insert into email_automations (event, template_key) values
  ('user.signup',                  'signup_verification'),
  ('user.password_reset',         'password_reset'),
  ('order.placed',                'order_confirmation'),
  ('order.dispatched',            'order_dispatched'),
  ('order.delivered',             'order_delivered'),
  ('subscriber.subscribed',       'newsletter_welcome')
on conflict (event) do nothing;

-- Seed the two integration rows so the admin form has something to read on first
-- load and does not have to distinguish "no row" from "not configured".
insert into integrations (id, provider) values
  ('payments', 'none'),
  ('email', 'none')
on conflict (id) do nothing;