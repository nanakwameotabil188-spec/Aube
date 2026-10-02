import 'server-only';

import { createPublicSupabaseClient } from '@/lib/supabase/public';
import { mapImage } from '@/lib/supabase/mappers';
import type { Tables } from '@/lib/supabase/types';
import type {
  Announcement,
  FooterColumn,
  HomeSection,
  OnboardingSlide,
  Promotion,
  ShippingMethod,
  StoreSettings,
} from '@/types';
import { storeSettings as fallbackSettings } from '@/data/settings';

/**
 * Supabase content repository.
 *
 * The catalog has had a repository since the start; the *content* layer did not,
 * which is why every non-catalogue admin screen wrote to the database and the
 * storefront never read it back. Branding, homepage composition, announcements,
 * footer columns, promotions, shipping methods and the intro slides all had that
 * shape. This is the missing half of the seam.
 *
 * Every reader returns `null` when Supabase is unavailable, and the caller falls
 * back to the in-repo content. That is deliberate: a storefront that renders
 * nothing because a database is unreachable is worse than one that shows
 * built-in content, and the fallback is a real, reviewable state rather than an
 * error page.
 *
 * Read with the anon client, never the service role. These are public pages, and
 * RLS already decides what the public may see — a hidden section is withheld by
 * policy, not by who is asking.
 */

type SectionRow = Tables<'home_sections'>;
type SlideRow = Tables<'onboarding_slides'>;
type ImageRow = Tables<'images'>;

/** Narrows a settings row to its jsonb value without trusting its shape. */
function readSetting<T>(rows: { value: unknown }[] | null, key: string, select: (raw: unknown) => T): T | null {
  const row = rows?.find((entry) => (entry as { key?: string }).key === key);
  if (!row) return null;
  try {
    return select(row.value);
  } catch {
    // A malformed record must not take the page down; the fallback is better
    // than a stack trace in the footer of a live storefront.
    return null;
  }
}

async function settingsValue<T>(key: string, select: (raw: unknown) => T): Promise<T | null> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.from('settings').select('key, value').eq('key', key);
  return readSetting(data as { value: unknown; key: string }[] | null, key, select);
}

/* ------------------------------------------------------------------ */
/* Brand settings                                                       */
/* ------------------------------------------------------------------ */

/** The subset of the brand record that lives in `settings`, and what shape it is in. */
interface BrandRecord {
  brandName?: string;
  legalName?: string;
  brandCode?: string;
  tagline?: string;
  description?: string;
  supportEmail?: string;
  supportPhone?: string;
  address?: string;
  logoId?: string | null;
  logoAlt?: string;
  faviconId?: string | null;
  shareImageId?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  social?: StoreSettings['social'];
  payments?: StoreSettings['payments'];
  taxNote?: string;
  freeShippingThreshold?: unknown;
  defaultShippingMethodId?: string;
  currency?: string;
  locale?: string;
}

const str = (raw: unknown, max = 400): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed.slice(0, max);
};

/**
 * Resolves an image id to a usable Image.
 *
 * The admin stores ids, because an id is what a relation is; the storefront
 * needs a URL, because a URL is what an `<img>` is. The translation happens
 * here so neither side has to know the other's representation.
 */
async function resolveImage(id: string | null | undefined): Promise<StoreSettings['logo']> {
  if (!id) return null;
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.from('images').select('*').eq('id', id).maybeSingle();
  return mapImage(data as ImageRow | null);
}

export async function readStoreSettings(): Promise<StoreSettings | null> {
  const record = await settingsValue<BrandRecord>('brand', (raw) => (raw ?? {}) as BrandRecord);
  if (!record) return null;

  const [logo, favicon, shareImage] = await Promise.all([
    resolveImage(record.logoId),
    resolveImage(record.faviconId),
    resolveImage(record.shareImageId),
  ]);

  // Merged over the in-repo defaults rather than replacing them, so a record
  // that only carries the fields the admin actually edits does not blank out
  // shipping thresholds, payment labels, or the social links.
  return {
    ...fallbackSettings,
    brandName: str(record.brandName, 60) ?? fallbackSettings.brandName,
    legalName: str(record.legalName, 120) ?? fallbackSettings.legalName,
    brandCode: str(record.brandCode, 10) ?? fallbackSettings.brandCode,
    tagline: str(record.tagline, 160) ?? fallbackSettings.tagline,
    description: str(record.description, 500) ?? fallbackSettings.description,
    supportEmail: str(record.supportEmail, 120) ?? fallbackSettings.supportEmail,
    supportPhone: str(record.supportPhone, 40) ?? fallbackSettings.supportPhone,
    address: typeof record.address === 'string' ? record.address : fallbackSettings.address,
    logo: logo ?? null,
    logoAlt: str(record.logoAlt, 120) ?? fallbackSettings.logoAlt,
    favicon: favicon ?? null,
    shareImage: shareImage ?? null,
    seoTitle: str(record.seoTitle, 160) ?? fallbackSettings.seoTitle,
    seoDescription: str(record.seoDescription, 300) ?? fallbackSettings.seoDescription,
    social: Array.isArray(record.social) ? (record.social as StoreSettings['social']) : fallbackSettings.social,
    payments: Array.isArray(record.payments) ? (record.payments as StoreSettings['payments']) : fallbackSettings.payments,
    taxNote: str(record.taxNote, 300) ?? fallbackSettings.taxNote,
    freeShippingThreshold:
      record.freeShippingThreshold &&
      typeof record.freeShippingThreshold === 'object' &&
      'amount' in (record.freeShippingThreshold as Record<string, unknown>)
        ? {
            amount: Number((record.freeShippingThreshold as { amount: number }).amount) || 0,
            currency: (str(record.currency, 3) ?? fallbackSettings.currency) as StoreSettings['currency'],
          }
        : fallbackSettings.freeShippingThreshold,
    defaultShippingMethodId:
      str(record.defaultShippingMethodId, 64) ?? fallbackSettings.defaultShippingMethodId,
    currency: (str(record.currency, 3) ?? fallbackSettings.currency) as StoreSettings['currency'],
    locale: str(record.locale, 10) ?? fallbackSettings.locale,
  } satisfies StoreSettings;
}

/* ------------------------------------------------------------------ */
/* Home sections                                                        */
/* ------------------------------------------------------------------ */

/**
 * Enabled homepage sections in display order.
 *
 * `payload` is merged under the columns because the seed and older records
 * predate the split: the payload is where the type-specific configuration
 * lives, and the columns carry the shared copy. Either may be authoritative for
 * a given field, so payload wins where both exist.
 */
export async function readHomeSections(): Promise<HomeSection[] | null> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('home_sections')
    .select('*, images(*)')
    .order('position', { ascending: true });

  if (error || !data?.length) return null;

  return (data as (SectionRow & { images: ImageRow | null })[]).map((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    return {
      ...payload,
      id: row.id,
      kind: row.kind,
      type: (payload.type ?? row.kind) as HomeSection['type'],
      position: row.position,
      enabled: row.enabled,
      theme: (payload.theme ?? undefined) as HomeSection['theme'],
      eyebrow: row.eyebrow ?? (payload.eyebrow as string | null) ?? null,
      title: row.title ?? (payload.title as string | null) ?? null,
      subtitle: row.subtitle ?? (payload.subtitle as string | null) ?? null,
      body: row.body ?? (payload.body as string | null) ?? null,
      cta: row.cta_label
        ? { label: row.cta_label, href: row.cta_href ?? '/', style: (row.cta_style ?? 'primary') as 'primary' }
        : undefined,
      image: mapImage(row.images),
    } as unknown as HomeSection;
  });
}

/* ------------------------------------------------------------------ */
/* Settings-keyed collections                                           */
/* ------------------------------------------------------------------ */

export async function readAnnouncements(): Promise<Announcement[] | null> {
  return settingsValue<Announcement[]>('announcements', (raw) =>
    Array.isArray(raw) ? (raw as Announcement[]) : [],
  );
}

export async function readFooterColumns(): Promise<FooterColumn[] | null> {
  return settingsValue<FooterColumn[]>('footer_columns', (raw) =>
    Array.isArray(raw) ? (raw as FooterColumn[]) : [],
  );
}

export async function readPromotions(): Promise<Promotion[] | null> {
  return settingsValue<Promotion[]>('promotions', (raw) =>
    Array.isArray(raw) ? (raw as Promotion[]) : [],
  );
}

export async function readShippingMethods(): Promise<ShippingMethod[] | null> {
  return settingsValue<ShippingMethod[]>('shipping_methods', (raw) =>
    Array.isArray(raw) ? (raw as ShippingMethod[]) : [],
  );
}

/* ------------------------------------------------------------------ */
/* Onboarding slides                                                    */
/* ------------------------------------------------------------------ */

export async function readOnboardingSlides(): Promise<OnboardingSlide[] | null> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('onboarding_slides')
    .select('*, images(*)')
    .order('position', { ascending: true });

  if (error || !data?.length) return null;

  return (data as (SlideRow & { images: ImageRow | null })[]).map((row) => ({
    id: row.id,
    position: row.position,
    enabled: row.enabled,
    eyebrow: row.eyebrow ?? '',
    title: row.title ?? '',
    body: row.body ?? '',
    // `undefined` rather than `null`: the slide type treats a missing image as
    // absent, and a null here would be a different state that reads as a bug.
    image: mapImage(row.images) ?? undefined,
    icon: (row.icon as OnboardingSlide['icon']) ?? undefined,
    ctaLabel: row.cta_label ?? undefined,
    ctaHref: row.cta_href ?? undefined,
  }));
}
