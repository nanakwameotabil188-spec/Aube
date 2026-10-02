-- =============================================================================
-- AUBE — initial schema
--
-- Mirrors the domain contracts in `src/types/index.ts` so the Supabase
-- repository can map rows to the same `Product`/`Order` shapes the mock layer
-- returns. Nothing in `src/components` needs to change when this is applied.
--
-- Conventions
--   * ids are `text`, holding the same slug-like ids the mock data uses
--     (`prod-azelaic-10`, `cat-serums`), so a seeded database and the mock
--     data reference the same identifiers.
--   * money is stored in **minor units** (integer cents), matching `Money.amount`.
--   * ordering is an explicit `position` integer everywhere, never implicit.
--   * timestamps are `timestamptz` and always stored in UTC.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- -----------------------------------------------------------------------------
-- Enumerated domains
-- -----------------------------------------------------------------------------

create type product_type as enum (
  'cleanser', 'essence', 'serum', 'moisturiser', 'eye', 'mask', 'oil', 'sunscreen', 'tool'
);

create type badge_tone as enum ('neutral', 'moss', 'clay', 'danger', 'ink');

create type order_status as enum (
  'pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'
);

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------

-- Kept in sync by trigger so a row can never disagree with its updated_at.
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Taxonomy
--
-- Categories, collections, skin types, skin concerns and ingredients are all
-- "term" rows distinguished by `kind`, because they share every field and are
-- queried interchangeably by the filter panel.
-- -----------------------------------------------------------------------------

create table taxonomy_terms (
  id            text primary key,
  kind          text not null check (kind in ('category', 'collection', 'skin_type', 'skin_concern', 'ingredient')),
  slug          text not null,
  name          text not null,
  short_description text not null default '',
  description   text,
  -- Ingredient-only fields, matching the `Ingredient` contract.
  aka           text[] not null default '{}',
  concentration text,
  benefits      text[] not null default '{}',
  origin        text,
  hero_product_id text,
  -- `SkinConcern.promise`: the reassurance line under a concern heading.
  promise       text,
  -- `Category`
  parent_id     text,
  product_type  product_type,
  -- `Collection`: whether membership is curated by hand or derived.
  rule          text check (rule in ('manual', 'auto')) default 'auto',
  product_ids   text[] not null default '{}',
  featured_product_id text,
  story         text,
  -- `Orderable`
  status        text not null default 'active' check (status in ('active', 'draft', 'archived')),
  seo_title     text,
  seo_description text,
  seo_canonical_path text,
  seo_no_index  boolean not null default false,
  tone          text,
  image_id      text,
  icon          text,
  position      integer not null default 0,
  visible       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint taxonomy_terms_kind_slug_key unique (kind, slug)
);

-- A category's parent must itself be a category.
alter table taxonomy_terms
  add constraint taxonomy_terms_parent_id_fkey
  foreign key (parent_id) references taxonomy_terms (id) on delete set null;

create index taxonomy_terms_kind_idx on taxonomy_terms (kind, position);

create trigger taxonomy_terms_set_updated_at
  before update on taxonomy_terms
  for each row execute function set_updated_at();

-- -----------------------------------------------------------------------------
-- Media
-- -----------------------------------------------------------------------------

create table images (
  id           text primary key,
  url          text not null,
  alt          text not null default '',
  width        integer,
  height       integer,
  blur_data_url text,
  created_at   timestamptz not null default now()
);

alter table taxonomy_terms
  add constraint taxonomy_terms_image_id_fkey
  foreign key (image_id) references images (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Products
-- -----------------------------------------------------------------------------

create table products (
  id             text primary key,
  slug           text not null unique,
  name           text not null,
  subtitle       text not null default '',
  brand          text not null default 'AUBE',
  short_description text not null default '',
  description    text not null default '',
  highlights     text[] not null default '{}',
  benefits       text[] not null default '{}',
  usage          text[] not null default '{}',
  ingredients_text text not null default '',
  warnings       text[],

  -- Minor units, matching `Money.amount`.
  price          integer not null check (price >= 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price >= 0),
  currency       text not null default 'USD',

  category_id    text not null references taxonomy_terms (id) on delete restrict,
  product_type   product_type not null,

  size           text not null default '',
  stock_quantity integer not null default 0,
  available_for_sale boolean not null default true,
  low_stock_threshold integer not null default 5,
  dispatch_estimate text,

  is_featured    boolean not null default false,
  is_best_seller boolean not null default false,
  is_new_arrival boolean not null default false,

  -- Manual merchandising, self-referential and therefore deferred constraints.
  related_product_ids text[] not null default '{}',
  frequently_bought_with_ids text[] not null default '{}',

  position       integer not null default 0,
  visible        boolean not null default true,

  seo_title      text,
  seo_description text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index products_position_idx on products (position) where visible;
create index products_category_idx on products (category_id) where visible;
create index products_type_idx on products (product_type) where visible;
create index products_featured_idx on products (is_featured) where visible and is_featured;
create index products_price_idx on products (price);
create index products_created_at_idx on products (created_at desc);

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

create table product_images (
  product_id text not null references products (id) on delete cascade,
  image_id   text not null references images (id) on delete cascade,
  position   integer not null default 0,
  is_primary boolean not null default false,
  primary key (product_id, image_id)
);

create index product_images_order_idx on product_images (product_id, position);

create table product_variants (
  id           text primary key,
  product_id   text not null references products (id) on delete cascade,
  sku          text not null unique,
  name         text not null default 'Standard',
  size         text not null default '',
  price        integer not null check (price >= 0),
  compare_at_price integer,
  stock_quantity integer not null default 0,
  image_id     text references images (id) on delete set null,
  position     integer not null default 0,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index product_variants_product_idx on product_variants (product_id, position);

create trigger product_variants_set_updated_at
  before update on product_variants
  for each row execute function set_updated_at();

create table product_badges (
  id         text primary key,
  product_id text not null references products (id) on delete cascade,
  label      text not null,
  tone       badge_tone not null default 'neutral',
  position   integer not null default 0
);

create index product_badges_product_idx on product_badges (product_id, position);

create table product_key_ingredients (
  product_id   text not null references products (id) on delete cascade,
  ingredient_id text not null references taxonomy_terms (id) on delete cascade,
  note         text not null default '',
  position     integer not null default 0,
  primary key (product_id, ingredient_id)
);

-- Many-to-many facets. Arrays on `products` would be smaller, but join tables
-- are what make the admin filter panel and "bought together" queries possible.
create table product_collections (
  product_id   text not null references products (id) on delete cascade,
  collection_id text not null references taxonomy_terms (id) on delete cascade,
  position     integer not null default 0,
  primary key (product_id, collection_id)
);

create table product_skin_types (
  product_id text not null references products (id) on delete cascade,
  skin_type_id text not null references taxonomy_terms (id) on delete cascade,
  position   integer not null default 0,
  primary key (product_id, skin_type_id)
);

create table product_skin_concerns (
  product_id   text not null references products (id) on delete cascade,
  skin_concern_id text not null references taxonomy_terms (id) on delete cascade,
  position     integer not null default 0,
  primary key (product_id, skin_concern_id)
);

create table product_ingredients (
  product_id   text not null references products (id) on delete cascade,
  ingredient_id text not null references taxonomy_terms (id) on delete cascade,
  position     integer not null default 0,
  primary key (product_id, ingredient_id)
);

create table product_hero_ingredients (
  product_id   text not null references products (id) on delete cascade,
  ingredient_id text not null references taxonomy_terms (id) on delete cascade,
  position     integer not null default 0,
  primary key (product_id, ingredient_id)
);

-- -----------------------------------------------------------------------------
-- Reviews
-- -----------------------------------------------------------------------------

create table reviews (
  id            text primary key,
  product_id    text not null references products (id) on delete cascade,
  author        text not null,
  verified      boolean not null default false,
  rating        integer not null check (rating between 1 and 5),
  title         text not null default '',
  body          text not null,
  skin_type_id  text references taxonomy_terms (id) on delete set null,
  helpful_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create index reviews_product_idx on reviews (product_id, created_at desc);
create index reviews_product_rating_idx on reviews (product_id, rating desc);

create table review_skin_concerns (
  review_id      text not null references reviews (id) on delete cascade,
  skin_concern_id text not null references taxonomy_terms (id) on delete cascade,
  primary key (review_id, skin_concern_id)
);

create table review_images (
  review_id text not null references reviews (id) on delete cascade,
  image_id  text not null references images (id) on delete cascade,
  position  integer not null default 0,
  primary key (review_id, image_id)
);

-- -----------------------------------------------------------------------------
-- Customers and orders
-- -----------------------------------------------------------------------------

create table customers (
  id         text primary key,
  email      citext not null unique,
  full_name  text not null default '',
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

create table addresses (
  id         text primary key,
  customer_id text references customers (id) on delete cascade,
  full_name  text not null default '',
  line1      text not null default '',
  line2      text,
  city       text not null default '',
  region     text,
  postal_code text not null default '',
  country    text not null default 'GB',
  phone      text,
  is_default_shipping boolean not null default false,
  is_default_billing  boolean not null default false,
  created_at timestamptz not null default now()
);

create table orders (
  id                 text primary key,
  number             text not null unique,
  status             order_status not null default 'pending',
  customer_id        text references customers (id) on delete set null,
  customer_email     citext not null,
  customer_name      text not null default '',
  shipping_address_id text not null references addresses (id) on delete restrict,
  billing_address_id  text not null references addresses (id) on delete restrict,
  shipping_method_id text not null,
  shipping_method_name text not null default '',
  -- Minor units, denormalised so an order's total survives a later price or
  -- tax-rule change; the storefront never re-prices a placed order.
  subtotal           integer not null default 0,
  discount_total     integer not null default 0,
  shipping_total     integer not null default 0,
  tax_total          integer not null default 0,
  total              integer not null default 0,
  currency           text not null default 'USD',
  payment_method_label text not null default 'Card',
  -- Last four only. A full PAN is never written to this database.
  payment_last4      text check (payment_last4 is null or payment_last4 ~ '^[0-9]{4}$'),
  tracking_number    text,
  tracking_url       text,
  placed_at          timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index orders_status_idx on orders (status, placed_at desc);
create index orders_placed_at_idx on orders (placed_at desc);
create index orders_email_idx on orders (customer_email);

create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

create table order_lines (
  id          text primary key,
  order_id    text not null references orders (id) on delete cascade,
  product_id  text references products (id) on delete set null,
  variant_id  text references product_variants (id) on delete set null,
  -- Denormalised on purpose: an order line must still render after a product
  -- is renamed, archived or deleted.
  product_name text not null,
  variant_name text not null default '',
  sku          text,
  image_id     text references images (id) on delete set null,
  quantity     integer not null check (quantity > 0),
  unit_price   integer not null check (unit_price >= 0),
  line_total   integer not null check (line_total >= 0),
  position     integer not null default 0
);

create index order_lines_order_idx on order_lines (order_id, position);

create table order_discounts (
  id          text primary key,
  order_id    text not null references orders (id) on delete cascade,
  code        text not null,
  label       text not null,
  amount      integer not null default 0,
  position    integer not null default 0
);

create index order_discounts_order_idx on order_discounts (order_id, position);

create table order_events (
  id         text primary key,
  order_id   text not null references orders (id) on delete cascade,
  label      text not null,
  status     order_status,
  occurred_at timestamptz not null default now()
);

create index order_events_order_idx on order_events (order_id, occurred_at);

-- -----------------------------------------------------------------------------
-- Store settings and content
-- -----------------------------------------------------------------------------

create table settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger settings_set_updated_at
  before update on settings
  for each row execute function set_updated_at();

create table shipping_methods (
  id          text primary key,
  name        text not null,
  description text not null default '',
  price       integer not null default 0,
  currency    text not null default 'USD',
  position    integer not null default 0,
  visible     boolean not null default true
);

create table home_sections (
  id       text primary key,
  kind     text not null,
  payload  jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  visible  boolean not null default true
);

create table journal_posts (
  id          text primary key,
  slug        text not null unique,
  title       text not null,
  excerpt     text not null default '',
  body        text not null default '',
  category    text not null default '',
  author      text not null default 'AUBE',
  read_minutes integer not null default 4,
  image_id    text references images (id) on delete set null,
  related_product_ids text[] not null default '{}',
  seo_title   text,
  seo_description text,
  published_at timestamptz,
  position    integer not null default 0,
  visible     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index journal_posts_published_idx on journal_posts (published_at desc) where visible;

create trigger journal_posts_set_updated_at
  before update on journal_posts
  for each row execute function set_updated_at();

create table policies (
  id         text primary key,
  slug       text not null unique,
  title      text not null,
  summary    text not null default '',
  body       text not null default '',
  position   integer not null default 0,
  updated_at timestamptz not null default now()
);

create table faq_items (
  id         text primary key,
  scope      text not null default 'general',
  question   text not null,
  answer     text not null,
  position   integer not null default 0,
  visible    boolean not null default true
);

create index faq_items_scope_idx on faq_items (scope, position);

create table navigation_links (
  id         text primary key,
  parent_id  text references navigation_links (id) on delete cascade,
  label      text not null,
  href       text not null,
  position   integer not null default 0,
  visible    boolean not null default true
);

create index navigation_links_parent_idx on navigation_links (parent_id, position);

create table promotions (
  id          text primary key,
  code        text not null unique,
  label       text not null,
  kind        text not null default 'percentage' check (kind in ('percentage', 'fixed', 'shipping')),
  value       integer not null default 0,
  min_subtotal integer,
  starts_at   timestamptz,
  ends_at     timestamptz,
  visible     boolean not null default true
);

-- =============================================================================
-- Row Level Security
--
-- The storefront reads the published catalog as anyone; the admin panel writes
-- with the service role, which bypasses RLS entirely. Every table denies by
-- default, so a policy added later cannot accidentally expose a column.
-- =============================================================================

alter table taxonomy_terms   enable row level security;
alter table images           enable row level security;
alter table products         enable row level security;
alter table product_images   enable row level security;
alter table product_variants enable row level security;
alter table product_badges   enable row level security;
alter table product_key_ingredients   enable row level security;
alter table product_collections       enable row level security;
alter table product_skin_types        enable row level security;
alter table product_skin_concerns     enable row level security;
alter table product_ingredients       enable row level security;
alter table product_hero_ingredients  enable row level security;
alter table reviews         enable row level security;
alter table review_skin_concerns enable row level security;
alter table review_images   enable row level security;
alter table shipping_methods enable row level security;
alter table home_sections   enable row level security;
alter table journal_posts    enable row level security;
alter table policies         enable row level security;
alter table faq_items        enable row level security;
alter table navigation_links enable row level security;
alter table promotions       enable row level security;

-- Customer-owned data is never readable by the anon role.
alter table customers        enable row level security;
alter table addresses        enable row level security;
alter table orders           enable row level security;
alter table order_lines      enable row level security;
alter table order_discounts  enable row level security;
alter table order_events     enable row level security;
alter table settings         enable row level security;

-- Published storefront reads.
create policy "public read visible taxonomy"
  on taxonomy_terms for select using (visible);
create policy "public read images"
  on images for select using (true);
create policy "public read visible products"
  on products for select using (visible);
create policy "public read product images"
  on product_images for select using (true);
create policy "public read variants"
  on product_variants for select using (true);
create policy "public read badges"
  on product_badges for select using (true);
create policy "public read key ingredients"
  on product_key_ingredients for select using (true);
create policy "public read product collections"
  on product_collections for select using (true);
create policy "public read product skin types"
  on product_skin_types for select using (true);
create policy "public read product skin concerns"
  on product_skin_concerns for select using (true);
create policy "public read product ingredients"
  on product_ingredients for select using (true);
create policy "public read hero ingredients"
  on product_hero_ingredients for select using (true);
create policy "public read reviews"
  on reviews for select using (true);
create policy "public read review concerns"
  on review_skin_concerns for select using (true);
create policy "public read review images"
  on review_images for select using (true);
create policy "public read shipping methods"
  on shipping_methods for select using (visible);
create policy "public read home sections"
  on home_sections for select using (visible);
create policy "public read published journal"
  on journal_posts for select using (visible and published_at is not null);
create policy "public read policies"
  on policies for select using (true);
create policy "public read faq items"
  on faq_items for select using (visible);
create policy "public read navigation"
  on navigation_links for select using (visible);
create policy "public read active promotions"
  on promotions for select using (visible);

-- A shopper may read and update only their own profile and orders.
create or replace function current_customer_id() returns text
language sql stable as $$
  select nullif(
    (select auth.jwt() -> 'app_metadata' ->> 'customer_id'),
    ''
  );
$$;

create policy "customers read own"
  on customers for select using (id = current_customer_id());
create policy "customers update own"
  on customers for update using (id = current_customer_id());

create policy "addresses manage own"
  on addresses for all
  using (customer_id = current_customer_id())
  with check (customer_id = current_customer_id());

create policy "orders read own"
  on orders for select using (customer_id = current_customer_id());
create policy "order lines read own"
  on order_lines for select using (
    order_id in (select id from orders where customer_id = current_customer_id())
  );
create policy "order discounts read own"
  on order_discounts for select using (
    order_id in (select id from orders where customer_id = current_customer_id())
  );
create policy "order events read own"
  on order_events for select using (
    order_id in (select id from orders where customer_id = current_customer_id())
  );

-- -----------------------------------------------------------------------------
-- Rating summary
--
-- Read through this rather than summing in application code, so the product
-- page, the card and the JSON-LD cannot disagree about a product's rating.
-- -----------------------------------------------------------------------------

create or replace view product_rating_summary as
select
  p.id as product_id,
  coalesce(round(avg(r.rating)::numeric, 2), 0)::float as average,
  count(r.id)::int as count,
  array[
    coalesce(count(*) filter (where r.rating = 1), 0),
    coalesce(count(*) filter (where r.rating = 2), 0),
    coalesce(count(*) filter (where r.rating = 3), 0),
    coalesce(count(*) filter (where r.rating = 4), 0),
    coalesce(count(*) filter (where r.rating = 5), 0)
  ]::int[] as distribution
from products p
left join reviews r on r.product_id = p.id
group by p.id;
