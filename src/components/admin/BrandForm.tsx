'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import type { BrandSettings } from '@/lib/supabase/admin-content';
import { saveBrandSettings, type AdminActionResult } from '@/lib/actions/admin';
import { MediaUploader } from './MediaUploader';

/**
 * Brand settings form.
 *
 * This is the single place the business name, contact details, and default SEO
 * copy are edited. Everything that displays the brand — navbar, footer, admin
 * header, page metadata, structured data, order numbers, and SKUs — reads from
 * the same record, so a rename here propagates site-wide without a deploy.
 *
 * Logo, favicon, and share image are stored as image ids so they can be picked
 * from the media library. They are optional: with no logo the storefront falls
 * back to a text wordmark rather than rendering an empty slot.
 */

const inputClass =
  'mt-1.5 w-full rounded-md border border-line bg-shell px-3 py-2 text-sm outline-none focus:border-line-strong';

function Field({
  label,
  name,
  defaultValue,
  maxLength = 200,
  hint,
  required,
}: {
  label: string;
  name: keyof BrandSettings;
  defaultValue: string;
  maxLength?: number;
  hint?: string;
  required?: boolean;
}) {
  const id = `brand-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        maxLength={maxLength}
        defaultValue={defaultValue}
        required={required}
        className={inputClass}
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/**
 * One brand image: current preview, a choice, and an upload.
 *
 * The id lives in a hidden input, so the form still posts the same
 * `logoId` / `faviconId` / `shareImageId` the write path already expects — the
 * change is to the interface, not the contract.
 */
function BrandImageField({
  label,
  hint,
  name,
  value,
  media,
}: {
  label: string;
  hint: string;
  name: 'logoId' | 'faviconId' | 'shareImageId';
  value: string;
  media: { id: string; url: string; alt: string }[];
}) {
  const current = media.find((item) => item.id === value) ?? null;
  const id = `brand-image-${name}`;

  return (
    <div className="rounded-md border border-line bg-shell p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-porcelain">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.url} alt="" className="size-full object-contain" />
          ) : (
            <span className="px-2 text-center text-xs text-muted">None</span>
          )}
        </div>

        <div className="min-w-[12rem] flex-1">
          <label htmlFor={id} className="block text-sm font-medium">
            {label}
          </label>
          <p className="mt-0.5 text-xs text-muted">{hint}</p>

          <input type="hidden" name={name} value={value} />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              id={id}
              value={value}
              onChange={(event) => {
                // The hidden input is uncontrolled, so it is updated directly
                // rather than through state — this component has no other state
                // and does not need a re-render to stay in sync.
                const hidden = event.currentTarget.form?.elements.namedItem(name) as HTMLInputElement | null;
                if (hidden) hidden.value = event.target.value;
              }}
              className="min-w-[14rem] rounded-md border border-line bg-shell px-3 py-2 text-sm"
            >
              <option value="">None — use the default</option>
              {media.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.alt || item.id}
                </option>
              ))}
            </select>

            {current ? (
              <button
                type="button"
                onClick={() => {
                  const select = document.getElementById(id) as HTMLSelectElement | null;
                  const hidden = select?.form?.elements.namedItem(name) as HTMLInputElement | null;
                  if (select) select.value = '';
                  if (hidden) hidden.value = '';
                }}
                className="rounded-md border border-line px-3 py-2 text-sm hover:bg-sand"
              >
                Clear
              </button>
            ) : null}
          </div>

          {media.length === 0 ? (
            <p className="mt-2 text-xs text-muted">
              No images in the library yet — upload one below and it will appear in this list.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <MediaUploader defaultFolder="branding" compact />
      </div>
    </div>
  );
}

export function BrandForm({  settings,
  media = [],
}: {
  settings: BrandSettings;
  media?: { id: string; url: string; alt: string }[];
}) {
  const [state, action, pending] = useActionState<AdminActionResult | null, FormData>(
    saveBrandSettings,
    null,
  );
  const router = useRouter();

  return (
    <form action={action} className="max-w-3xl space-y-8">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
          Identity
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website name" name="brandName" defaultValue={settings.brandName} maxLength={60} required />
          <Field label="Legal name" name="legalName" defaultValue={settings.legalName} maxLength={120} />
        </div>

        <Field
          label="Brand code"
          name="brandCode"
          defaultValue={settings.brandCode}
          maxLength={10}
          hint="2–10 letters or digits. Used as the prefix for order numbers and SKUs."
        />

        <Field label="Tagline" name="tagline" defaultValue={settings.tagline} maxLength={160} />

        <div>
          <label htmlFor="brand-description" className="block text-sm font-medium">
            Brand description
          </label>
          <textarea
            id="brand-description"
            name="description"
            rows={3}
            maxLength={500}
            defaultValue={settings.description}
            className={inputClass}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
          Contact
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Support email" name="supportEmail" defaultValue={settings.supportEmail} maxLength={120} />
          <Field label="Support phone" name="supportPhone" defaultValue={settings.supportPhone} maxLength={40} />
        </div>

        <div>
          <label htmlFor="brand-address" className="block text-sm font-medium">
            Address
          </label>
          <textarea
            id="brand-address"
            name="address"
            rows={2}
            maxLength={300}
            defaultValue={settings.address}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-muted">Shown in the footer. Left blank, it is not shown.</p>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
          Logo and images
        </legend>

        {/*
          Previously three text inputs labelled "Logo id", "Favicon id" and
          "Share image id", expecting the operator to know a media-library row
          identifier and paste it. There is no way to guess an id, so in practice
          the fields stayed blank and the admin had no way to set a logo at all.

          These are now previews plus a picker, and the ids are carried in hidden
          inputs. The reference is still stored as an id — a relation should be
          an id — it is just never asked of the person using the form.
        */}
        <BrandImageField
          label="Logo"
          hint="Appears in the header and footer. Leave empty to use the business name as text."
          name="logoId"
          value={settings.logoId ?? ''}
          media={media}
        />

        <BrandImageField
          label="Favicon"
          hint="The small icon in the browser tab. Square images work best."
          name="faviconId"
          value={settings.faviconId ?? ''}
          media={media}
        />

        <BrandImageField
          label="Share image"
          hint="Shown when someone shares a link to the shop on social media. Roughly 1200 by 630."
          name="shareImageId"
          value={settings.shareImageId ?? ''}
          media={media}
        />

        <Field label="Logo alt text" name="logoAlt" defaultValue={settings.logoAlt} maxLength={120} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
          Default SEO
        </legend>

        <Field label="Default page title" name="seoTitle" defaultValue={settings.seoTitle} maxLength={160} />

        <div>
          <label htmlFor="brand-seo-description" className="block text-sm font-medium">
            Default meta description
          </label>
          <textarea
            id="brand-seo-description"
            name="seoDescription"
            rows={2}
            maxLength={300}
            defaultValue={settings.seoDescription}
            className={inputClass}
          />
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink px-4 py-2 text-sm text-porcelain transition-colors hover:bg-ink-soft disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save brand settings'}
        </button>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          Refresh
        </button>
        {state ? (
          <p
            role="status"
            className={
              state.ok
                ? 'rounded-md border border-line bg-success-soft px-4 py-2.5 text-sm text-success'
                : 'rounded-md border border-line bg-danger-soft px-4 py-2.5 text-sm text-danger'
            }
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
