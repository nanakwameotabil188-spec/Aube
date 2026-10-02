-- =============================================================================
-- 0003_storage_limits.sql
--
-- Constrains the storage buckets to the limits the upload path already
-- enforces in `src/lib/supabase/storage.ts`.
--
-- Why this file exists: validating an upload in application code is only a
-- speed bump. The Storage API is directly reachable with the anon key, so the
-- same restriction has to exist on the bucket itself or it is not a
-- restriction at all. An 8MB cap and an image-only MIME allowlist match
-- `MAX_UPLOAD_BYTES` and `ALLOWED_MIME` in storage.ts.
--
-- Note that `allowed_mime_types` is matched exactly, so it lists every type
-- the app accepts. A type missing here is rejected at the bucket even though
-- the app would have permitted it — that asymmetry is intentional, since the
-- bucket is the stricter of the two and both lists are maintained together.
-- =============================================================================

-- `on conflict do update` rather than `do nothing`: 0002 created these buckets
-- with the platform default limit, so a re-run has to actually tighten them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public', 'public', true, 8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public             = excluded.public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-private', 'admin-private', false, 8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public             = excluded.public;
