-- =============================================================================
-- 0002_content_cms.sql
--
-- Adds the content-management surface: onboarding slides, homepage section
-- configuration, review moderation, admin roles, and media storage.
--
-- Design notes that matter:
--
--  * A rating is only ever derived from reviews that are both published and
--    approved. The 0001 view counted every row, which meant a pending or
--    rejected review still moved the public score. That view is replaced.
--
--  * `onboarding_slides` and `home_sections` are relational, not jsonb
--    blobs, so the admin can sort, filter, and validate them. `home_sections`
--    keeps its `payload` column for the type-specific bits a generic set of
--    columns cannot express.
--
--  * Administrative writes are gated by a `is_admin()` helper reading the
--    caller's own row in `admin_users`. The service-role key bypasses RLS
--    entirely, so every server action must additionally verify the session
--    before touching the admin client.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Admin roles
-- -----------------------------------------------------------------------------

create table admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  -- 'admin' can write everything; 'editor' can write content but not settings.
  role       text not null default 'editor' check (role in ('admin', 'editor')),
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger admin_users_set_updated_at
  before update on admin_users
  for each row execute function set_updated_at();

create index admin_users_active_idx on admin_users (active) where active;

alter table admin_users enable row level security;

-- The helper every admin policy checks. `security definer` is required so the
-- policy can read `admin_users` without recursing through its own RLS.
create or replace function is_admin(required_role text default 'editor')
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from admin_users a
    where a.user_id = auth.uid()
      and a.active
      and (required_role = 'editor' or a.role = 'admin')
  );
$$;

-- An admin may read the admin list. Nobody may grant themselves a role: only
-- an existing admin can insert or change roles.
create policy "admins read admin users"
  on admin_users for select using (is_admin());
create policy "admins manage admin users"
  on admin_users for all using (is_admin('admin'))
  with check (is_admin('admin'));

-- -----------------------------------------------------------------------------
-- Onboarding slides
--
-- The first-visit introduction. One row per slide; `position` is the display
-- order and `enabled` retires a slide without deleting it.
-- -----------------------------------------------------------------------------

create table onboarding_slides (
  id         text primary key,
  eyebrow    text,
  title      text not null check (length(trim(title)) > 0),
  body       text not null check (length(trim(body)) > 0),
  image_id   text references images (id) on delete set null,
  -- Icon used when a slide carries no image. Constrained to the glyphs the
  -- frontend actually renders, so a bad value fails at write time.
  icon       text check (
    icon is null or icon in (
      'cart','heart','search','user','menu','close','chevron-down','chevron-right',
      'chevron-left','arrow-right','arrow-left','plus','minus','check','star',
      'filter','truck','leaf','droplet','sun','sparkle','shield','flask','moon',
      'wind','trash','refresh','grid','rows','info','lock','package','gift'
    )
  ),
  cta_label  text,
  cta_href   text,
  -- Only one of image/icon is required, so a slide is never blank.
  position   integer not null default 0,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint onboarding_slides_need_visual check (image_id is not null or icon is not null),
  -- A CTA needs both halves; a label pointing nowhere is a dead end for a
  -- first-time visitor.
  constraint onboarding_slides_cta_is_whole check (
    (cta_label is null and cta_href is null) or
    (cta_label is not null and cta_href is not null and length(trim(cta_href)) > 0)
  )
);

create index onboarding_slides_order_idx on onboarding_slides (position) where enabled;

create trigger onboarding_slides_set_updated_at
  before update on onboarding_slides
  for each row execute function set_updated_at();

alter table onboarding_slides enable row level security;

create policy "public read enabled onboarding slides"
  on onboarding_slides for select using (enabled);
create policy "admins manage onboarding slides"
  on onboarding_slides for all using (is_admin())
  with check (is_admin());

-- -----------------------------------------------------------------------------
-- Homepage sections
--
-- The generic columns below are the ones the admin form edits for every
-- section type. `payload` holds the type-specific configuration (product ids,
-- concern ids, step lists) and is validated per `kind` in application code.
-- -----------------------------------------------------------------------------

alter table home_sections
  add column eyebrow   text,
  add column title     text,
  add column subtitle  text,
  add column body      text,
  add column cta_label text,
  add column cta_href  text,
  add column cta_style text check (cta_style is null or cta_style in ('primary', 'secondary', 'text')),
  add column image_id  text references images (id) on delete set null,
  add column enabled   boolean not null default true,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

-- `kind` and `payload` already existed; `visible` is superseded by `enabled`.
update home_sections set enabled = visible;

create index home_sections_enabled_order_idx on home_sections (position) where enabled;

create trigger home_sections_set_updated_at
  before update on home_sections
  for each row execute function set_updated_at();

alter table home_sections enable row level security;

-- Public reads only enabled sections; the admin sees drafts.
drop policy if exists "public read home sections" on home_sections;
create policy "public read enabled home sections"
  on home_sections for select using (enabled);
create policy "admins manage home sections"
  on home_sections for all using (is_admin())
  with check (is_admin());

-- -----------------------------------------------------------------------------
-- Review moderation
--
-- 0001 had no moderation state at all, so anything inserted became public
-- immediately. A review now has to be approved *and* published to count.
-- -----------------------------------------------------------------------------

alter table reviews
  -- `text`, not `uuid`: `customers.id` and `current_customer_id()` are both
  -- text in 0001, and a uuid here would not be implementable as a foreign key.
  add column customer_id   text references customers (id) on delete set null,
  add column moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  add column published      boolean not null default false,
  add column moderated_by   uuid references admin_users (user_id) on delete set null,
  add column moderated_at   timestamptz,
  add column updated_at     timestamptz not null default now();

create trigger reviews_set_updated_at
  before update on reviews
  for each row execute function set_updated_at();

-- The hot path: "approved, published reviews for this product, newest first".
create index reviews_public_idx
  on reviews (product_id, created_at desc)
  where moderation_status = 'approved' and published;

alter table reviews enable row level security;

-- Customers may submit (status starts pending, published false) and read back
-- their own. The client cannot set a review to approved — RLS `with check`
-- pins those two columns.
create policy "customers submit reviews"
  on reviews for insert with check (
    customer_id = current_customer_id()
    and moderation_status = 'pending'
    and published = false
  );
create policy "customers read own reviews"
  on reviews for select using (customer_id = current_customer_id());

-- Only published, approved reviews are public.
create policy "public read published reviews"
  on reviews for select using (moderation_status = 'approved' and published);

create policy "admins moderate reviews"
  on reviews for all using (is_admin())
  with check (is_admin());

-- Keep `helpful_count` honest: it is a counter, not a number an admin types.
create or replace function increment_review_helpful(target_review_id text)
returns void
language sql security definer set search_path = public as $$
  update reviews
  set helpful_count = helpful_count + 1
  where id = target_review_id
    and moderation_status = 'approved'
    and published;
$$;

-- -----------------------------------------------------------------------------
-- Rating summary, corrected
--
-- 0001's view averaged every review regardless of moderation state and
-- coalesced the average to 0, which published `ratingValue: 0` for unrated
-- products. This version emits NULL for "no public reviews" so the frontend
-- renders "No reviews yet" instead of a zero.
-- -----------------------------------------------------------------------------

drop view if exists product_rating_summary;

create or replace view product_rating_summary as
select
  p.id as product_id,
  -- NULL, not 0: there is no average when there are no reviews.
  round(avg(r.rating)::numeric, 2)::float as average,
  count(r.id)::int as count,
  array[
    coalesce(count(*) filter (where r.rating = 1), 0),
    coalesce(count(*) filter (where r.rating = 2), 0),
    coalesce(count(*) filter (where r.rating = 3), 0),
    coalesce(count(*) filter (where r.rating = 4), 0),
    coalesce(count(*) filter (where r.rating = 5), 0)
  ]::int[] as distribution
from products p
left join reviews r
  on r.product_id = p.id
 and r.moderation_status = 'approved'
 and r.published
group by p.id;

-- -----------------------------------------------------------------------------
-- Media
--
-- `images` gains the storage provenance the admin needs to manage uploads.
-- Prototype rows are all remote URLs; an admin upload writes a storage_path
-- alongside them.
-- -----------------------------------------------------------------------------

alter table images
  add column storage_path text,
  add column mime_type    text,
  add column byte_size    integer check (byte_size is null or byte_size >= 0),
  add column uploaded_by  uuid references admin_users (user_id) on delete set null,
  add column updated_at   timestamptz not null default now();

create trigger images_set_updated_at
  before update on images
  for each row execute function set_updated_at();

-- An image is either a real external URL or a storage object, never neither.
alter table images
  add constraint images_have_a_source check (
    nullif(btrim(url), '') is not null or nullif(btrim(storage_path), '') is not null
  );

create index images_storage_path_idx on images (storage_path) where storage_path is not null;

alter table images enable row level security;

-- "public read images" already exists from 0001 with the same definition; it
-- is not recreated here. Only the admin-side policy is new.
create policy "admins manage images" on images for all using (is_admin())
  with check (is_admin());

-- -----------------------------------------------------------------------------
-- Storage buckets
--
-- `public` holds customer-facing media (product shots, hero images) and is
-- world-readable. `admin-private` holds draft uploads. Read/write policies are
-- scoped to the `is_admin()` helper so an anonymous visitor cannot write.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('public', 'public', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('admin-private', 'admin-private', false)
on conflict (id) do nothing;

create policy "public read public bucket"
  on storage.objects for select using (bucket_id = 'public');

create policy "admins write public bucket"
  on storage.objects for insert with check (bucket_id = 'public' and is_admin());
create policy "admins update public bucket"
  on storage.objects for update using (bucket_id = 'public' and is_admin())
  with check (bucket_id = 'public' and is_admin());
create policy "admins delete public bucket"
  on storage.objects for delete using (bucket_id = 'public' and is_admin());

create policy "admins read private bucket"
  on storage.objects for select using (bucket_id = 'admin-private' and is_admin());
create policy "admins write private bucket"
  on storage.objects for all
  using (bucket_id = 'admin-private' and is_admin())
  with check (bucket_id = 'admin-private' and is_admin());

-- -----------------------------------------------------------------------------
-- Brand settings
--
-- `settings` is a key/value table from 0001. These rows are the brand fields
-- the admin form writes. Seeded so a fresh project has a working, editable
-- starting point rather than an empty storefront.
-- -----------------------------------------------------------------------------

insert into settings (key, value) values
  ('brand', jsonb_build_object(
    'brandName', 'AUBE',
    'legalName', 'AUBE Skin Ltd.',
    'brandCode', 'AUBE',
    'tagline', 'Clinical skincare, quietly considered.',
    'description', 'Formulated skincare built on published evidence.',
    'supportEmail', 'care@example.com',
    'supportPhone', '',
    'address', '',
    'logoId', null,
    'logoAlt', 'AUBE',
    'faviconId', null,
    'shareImageId', null,
    'seoTitle', 'AUBE — Clinical skincare, quietly considered.',
    'seoDescription', 'A short range of skincare built around published evidence.'
  ))
on conflict (key) do update set value = excluded.value, updated_at = now();

alter table settings enable row level security;

drop policy if exists "public read settings" on settings;
-- `brand` is public because the storefront must render it. Secrets belong in
-- environment variables, never in this table.
create policy "public read brand settings"
  on settings for select using (key = 'brand');
create policy "admins manage settings"
  on settings for all using (is_admin('admin'))
  with check (is_admin('admin'));
