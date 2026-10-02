import 'server-only';

import { createAdminSupabaseClient } from './admin';
import { getAdminStatus, type AdminStatus } from './admin-data';
import type { Tables } from './types';
import { mapImage } from './mappers';
import type { Image, OnboardingSlide } from '@/types';

/**
 * Admin content management.
 *
 * Reads and writes for the things the business owner changes without a
 * developer: homepage composition, onboarding slides, brand settings, review
 * moderation, and uploaded media.
 *
 * These functions use the service-role client, so the RLS policies written in
 * `0002_content_cms.sql` do not apply to them. Routes that call these must
 * have run `getAdminAuth()` first — that check is the only thing standing
 * between this file and the public internet, and it lives at the route layer
 * because that is the only layer that knows who is asking.
 *
 * Every function returns `null` when Supabase is not configured so the panel
 * can render its setup state instead of a stack trace.
 */

export type { AdminStatus };
export { getAdminStatus };

type SlideRow = Tables<'onboarding_slides'>;
type SectionRow = Tables<'home_sections'>;
type ReviewRow = Tables<'reviews'>;
type ImageRow = Tables<'images'>;

/* ------------------------------------------------------------------ */
/* Onboarding slides                                                   */
/* ------------------------------------------------------------------ */

export interface AdminSlide extends OnboardingSlide {
  imageId: string | null;
}

interface JoinedSlide extends SlideRow {
  images: ImageRow | null;
}

/** Every slide, including disabled ones — the admin has to see what it hid. */
export async function listOnboardingSlides(): Promise<AdminSlide[] | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('onboarding_slides')
    .select('*, images(*)')
    .order('position');

  if (error) throw new Error(error.message);

  return (data as JoinedSlide[]).map((row) => ({
    id: row.id,
    eyebrow: row.eyebrow ?? undefined,
    title: row.title,
    body: row.body,
    icon: (row.icon as OnboardingSlide['icon']) ?? undefined,
    image: row.images ? (mapImage(row.images) ?? undefined) : undefined,
    imageId: row.image_id,
    ctaLabel: row.cta_label ?? undefined,
    ctaHref: row.cta_href ?? undefined,
    position: row.position,
    enabled: row.enabled,
  }));
}

export type SlideWrite = {
  eyebrow: string | null;
  title: string;
  body: string;
  imageId: string | null;
  icon: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  position: number;
  enabled: boolean;
};

/** `SlideWrite` is camelCase for the form; the columns are snake_case. */
function toSlideColumns(
  values: SlideWrite,
): Omit<SlideRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    eyebrow: values.eyebrow,
    title: values.title,
    body: values.body,
    image_id: values.imageId,
    icon: values.icon,
    cta_label: values.ctaLabel,
    cta_href: values.ctaHref,
    position: values.position,
    enabled: values.enabled,
  };
}

export async function createOnboardingSlide(
  id: string,
  values: SlideWrite,
): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('onboarding_slides')
    .insert({ ...toSlideColumns(values), id });

  if (error) throw new Error(error.message);
  return true;
}

export async function updateOnboardingSlide(id: string, values: Partial<SlideWrite>): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  // Filled against DEFAULTS so every column is written; `id` is deliberately
  // excluded, because updating a primary key to the default would fail.
  const { error } = await supabase
    .from('onboarding_slides')
    .update(toSlideColumns({ ...DEFAULTS, ...values }))
    .eq('id', id);

  if (error) throw new Error(error.message);
  return true;
}

const DEFAULTS: SlideWrite = {
  eyebrow: null,
  title: '',
  body: '',
  imageId: null,
  icon: null,
  ctaLabel: null,
  ctaHref: null,
  position: 0,
  enabled: true,
};

export async function deleteOnboardingSlide(id: string): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from('onboarding_slides').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}

/**
 * Persist a new slide order.
 *
 * Written as one transaction so a partial failure cannot leave the sequence in
 * an order that does not match what the operator dragged. The ids are matched
 * against the rows that exist, so a stale drag cannot create or delete a slide.
 */
export async function reorderOnboardingSlides(orderedIds: string[]): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('onboarding_slides')
    .update({ position: 0 })
    .neq('id', '__none__')
    .select('id');

  if (error) throw new Error(error.message);
  const known = new Set((data ?? []).map((row) => row.id));

  const updates = orderedIds
    .map((id, index) => ({ id, position: index + 1 }))
    .filter((row) => known.has(row.id));

  if (updates.length === 0) return false;

  const { error: updateError } = await supabase.from('onboarding_slides').upsert(updates);
  if (updateError) throw new Error(updateError.message);
  return true;
}

/* ------------------------------------------------------------------ */
/* Homepage sections                                                   */
/* ------------------------------------------------------------------ */

export interface AdminSection {
  id: string;
  kind: string;
  position: number;
  enabled: boolean;
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
    ctaStyle: string | null;
    imageId: string | null;
    image: Image | null;
    /**
     * The type-specific half of the section — which categories, which products.
     *
     * Exposed so the admin can edit it. Held as jsonb because one set of columns
     * cannot express every section's own configuration, and the admin needs to
     * see the current value or there is nothing to change.
     */
    payload: Record<string, unknown>;
  }

interface JoinedSection extends SectionRow {
  images: ImageRow | null;
}

export async function listHomeSections(): Promise<AdminSection[] | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('home_sections')
    .select('*, images(*)')
    .order('position');

  if (error) throw new Error(error.message);

  return (data as JoinedSection[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    position: row.position,
    enabled: row.enabled,
    eyebrow: row.eyebrow,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
      ctaStyle: row.cta_style,
      imageId: row.image_id,
      image: mapImage(row.images),
      payload: (row.payload ?? {}) as Record<string, unknown>,
    }));
}

export type SectionWrite = {
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  ctaStyle: string | null;
  imageId: string | null;
  enabled: boolean;
};

/** `SectionWrite` is camelCase for the form; the columns are snake_case. */
function toSectionColumns(values: SectionWrite): Partial<SectionRow> {
  return {
    eyebrow: values.eyebrow,
    title: values.title,
    subtitle: values.subtitle,
    body: values.body,
    cta_label: values.ctaLabel,
    cta_href: values.ctaHref,
    cta_style: values.ctaStyle as SectionRow['cta_style'],
    image_id: values.imageId,
    enabled: values.enabled,
  };
}

export async function updateHomeSection(id: string, values: Partial<SectionWrite>): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('home_sections')
    .update(toSectionColumns({ ...SECTION_DEFAULTS, ...values }))
    .eq('id', id);

  if (error) throw new Error(error.message);
  return true;
}

/**
 * Merges keys into a section's `payload`, leaving the rest of the jsonb intact.
 *
 * The type-specific parts of a section (which categories, which products) live
 * in `payload`, not in columns, because one set of columns cannot express
 * "show these four cleansers" and "show the next three new arrivals" at once.
 *
 * Merge rather than replace: the caller is editing one part of a payload that
 * other parts own, and a whole-object write from a form would silently discard
 * whatever it did not know about.
 */
export async function updateHomeSectionPayload(
  id: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { data: current, error: readError } = await supabase
    .from('home_sections')
    .select('payload')
    .eq('id', id)
    .single();

  if (readError || !current) throw new Error(readError?.message ?? 'Section not found.');

  const existing = (current.payload ?? {}) as Record<string, unknown>;
  const next = { ...existing, ...patch };

  // Keep the mirrored scalars in step. `kind` decides which renderer runs and
  // `enabled` decides whether it runs at all, so a payload edit that left them
  // stale would produce a section that looks configured but never renders.
  const { error } = await supabase
    .from('home_sections')
    .update({ payload: next, kind: next.kind, enabled: next.enabled })
    .eq('id', id);

  if (error) throw new Error(error.message);
  return true;
}

const SECTION_DEFAULTS: SectionWrite = {
  eyebrow: null,
  title: null,
  subtitle: null,
  body: null,
  ctaLabel: null,
  ctaHref: null,
  ctaStyle: null,
  imageId: null,
  enabled: true,
};

/**
 * Creates a homepage section from a template.
 *
 * Templates rather than an empty row: a section with no payload renders as
 * nothing, so an unconfigured section would appear in the admin list looking
 * broken and tell nobody why. Each template ships the shape its renderer
 * expects, so a new section is valid the moment it exists.
 */
const SECTION_TEMPLATES: Record<string, { title: string; payload: Record<string, unknown> }> = {
  'category-showcase': {
    title: 'Shop by category',
    payload: {
      type: 'category-showcase',
      // Empty on purpose: the section shows nothing until categories are
      // chosen, so adding it cannot change a live homepage by accident.
      categoryIds: [],
      perCategory: 4,
      maxCategories: 4,
    },
  },
};

export async function createHomeSection(kind: string): Promise<string | null> {
  const template = SECTION_TEMPLATES[kind];
  if (!template) return null;

  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  // Sort to the end of the page, after whatever is already there.
  const { data: last } = await supabase
    .from('home_sections')
    .select('position')
    .order('position', { ascending: false })
    .limit(1);
  const position = (last?.[0]?.position ?? 0) + 1;

  const payload = { ...template.payload, kind, position, enabled: false, title: template.title };

  const { data, error } = await supabase
    .from('home_sections')
    .insert({ kind, position, payload, title: template.title, enabled: false })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function setSectionEnabled(id: string, enabled: boolean): Promise<boolean> {
  return updateHomeSection(id, { enabled });
}

export async function reorderHomeSections(orderedIds: string[]): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('home_sections')
    .update({ position: 0 })
    .neq('id', '__none__')
    .select('id');

  if (error) throw new Error(error.message);
  const known = new Set((data ?? []).map((row) => row.id));

  const updates = orderedIds
    .map((id, index) => ({ id, position: index + 1 }))
    .filter((row) => known.has(row.id));

  if (updates.length === 0) return false;

  const { error: updateError } = await supabase.from('home_sections').upsert(updates);
  if (updateError) throw new Error(updateError.message);
  return true;
}

/* ------------------------------------------------------------------ */
/* Review moderation                                                   */
/* ------------------------------------------------------------------ */

export interface AdminReview {
  id: string;
  productId: string;
  productName: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  published: boolean;
  createdAt: string;
}

export async function listReviewsForModeration(limit = 100): Promise<AdminReview[] | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('reviews')
    .select('id, product_id, author, rating, title, body, moderation_status, published, created_at, products(name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const joined = row as unknown as {
      products: { name: string } | null;
    };
    return {
      id: row.id,
      productId: row.product_id,
      productName: joined.products?.name ?? row.product_id,
      author: row.author,
      rating: row.rating,
      title: row.title,
      body: row.body,
      moderationStatus: row.moderation_status,
      published: row.published,
      createdAt: row.created_at,
    };
  });
}

export async function moderateReview(
  id: string,
  values: { moderationStatus: 'pending' | 'approved' | 'rejected'; published: boolean },
  moderatorId: string,
): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('reviews')
    .update({
      moderation_status: values.moderationStatus,
      published: values.published,
      moderated_by: moderatorId,
      moderated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
  return true;
}

/* ------------------------------------------------------------------ */
/* Brand settings                                                      */
/* ------------------------------------------------------------------ */

export interface BrandSettings {
  brandName: string;
  legalName: string;
  brandCode: string;
  tagline: string;
  description: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  logoId: string | null;
  logoAlt: string;
  faviconId: string | null;
  shareImageId: string | null;
  seoTitle: string;
  seoDescription: string;
}

const DEFAULT_BRAND: BrandSettings = {
  brandName: 'AUBE',
  legalName: 'AUBE Skin Ltd.',
  brandCode: 'AUBE',
  tagline: '',
  description: '',
  supportEmail: '',
  supportPhone: '',
  address: '',
  logoId: null,
  logoAlt: '',
  faviconId: null,
  shareImageId: null,
  seoTitle: '',
  seoDescription: '',
};

export async function readBrandSettings(): Promise<BrandSettings | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'brand')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_BRAND;

  const value = (data.value ?? {}) as Partial<BrandSettings>;
  return { ...DEFAULT_BRAND, ...value };
}

export async function writeBrandSettings(values: BrandSettings): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'brand', value: values as unknown as Record<string, never> });

  if (error) throw new Error(error.message);
  return true;
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

export interface AdminMedia {
  id: string;
  url: string;
  storagePath: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  createdAt: string;
}

export async function listMedia(limit = 200): Promise<AdminMedia[] | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('images')
    .select('id, url, storage_path, alt, width, height, mime_type, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    url: row.url,
    storagePath: row.storage_path,
    alt: row.alt,
    width: row.width,
    height: row.height,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  }));
}

/**
 * Register an uploaded object in the `images` table.
 *
 * The object itself is written to the storage bucket first; this records the
 * row the rest of the site references. A row is never created for an upload
 * that did not succeed.
 */
export async function registerMedia(input: {
  id: string;
  url: string;
  storagePath: string;
  alt: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
  uploadedBy?: string;
}): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from('images').insert({
    id: input.id,
    url: input.url,
    storage_path: input.storagePath,
    alt: input.alt,
    mime_type: input.mimeType,
    byte_size: input.byteSize,
    width: input.width ?? null,
    height: input.height ?? null,
    uploaded_by: input.uploadedBy ?? null,
  } as ImageRow);

  if (error) throw new Error(error.message);
  return true;
}

export async function updateMediaAlt(id: string, alt: string): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from('images').update({ alt }).eq('id', id);
  if (error) throw new Error(error.message);
  return true;
}
