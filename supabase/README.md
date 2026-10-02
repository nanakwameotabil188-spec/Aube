# Supabase

Schema, migrations and the generated-style database types for AUBE.

## Apply the schema

With the CLI linked to a project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste `migrations/0001_init.sql` into the SQL editor of a new project.

The migration is additive and idempotent in the sense that it can be re-run on a
fresh database; it is not designed to be re-applied over a populated one.

## What it creates

| Area | Tables |
|---|---|
| Taxonomy | `taxonomy_terms` (categories, collections, skin types, concerns, ingredients) |
| Media | `images` |
| Catalog | `products`, `product_images`, `product_variants`, `product_badges`, `product_key_ingredients` |
| Facets | `product_collections`, `product_skin_types`, `product_skin_concerns`, `product_ingredients`, `product_hero_ingredients` |
| Reviews | `reviews`, `review_skin_concerns`, `review_images` |
| Commerce | `customers`, `addresses`, `orders`, `order_lines`, `order_discounts`, `order_events` |
| Content | `settings`, `shipping_methods`, `home_sections`, `journal_posts`, `policies`, `faq_items`, `navigation_links`, `promotions` |

## Conventions that matter

- **Ids are `text`** and match the mock data's ids (`prod-azelaic-10`,
  `cat-serums`). A seeded database and `src/data` therefore reference the same
  identifiers, which is what makes switching `DATA_SOURCE` a no-op for content.
- **Money is integer minor units**, matching `Money.amount` in
  `src/types/index.ts`. A price of `$70.00` is `7000`.
- **Ordering is always an explicit `position` integer.** Never rely on row
  order; the `position` contract is used across the whole app.
- **Timestamps are `timestamptz`**, stored in UTC.
- **Order lines denormalise** product name, variant, sku and image so an order
  still renders after the catalog changes.

## Row Level Security

Enabled on every table, and denying by default. The published catalog is
readable by anyone; `customers`, `addresses` and `orders` are readable only by
the owning shopper, matched through `current_customer_id()` on the JWT's
`app_metadata.customer_id`.

The admin panel writes with the service-role key, which bypasses RLS. That is
deliberate and confined to `src/lib/supabase/admin.ts`.

To sign a staff member in through Auth, add the customer id as app metadata:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"customer_id": "cust-1"}'::jsonb
where email = 'you@example.com';
```

## Regenerating types

```bash
supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
```

## Regenerating image storage

The migration stores image URLs, not blobs. For a real deployment, put the
product and review images in a `product-images` bucket and store the public URL
in `images.url`. The `blur_data_url` column exists for the blur placeholder.
