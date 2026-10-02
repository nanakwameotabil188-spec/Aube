'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { AdminProductDetail, AdminTaxonomyGroup } from '@/lib/supabase/admin-data';
import type { AdminMedia } from '@/lib/supabase/admin-content';
import { removeProduct, saveProduct } from '@/lib/actions/admin';
import {
  Checkbox,
  FacetPicker,
  LineListField,
  Row,
  Section,
  SelectField,
  inputClass,
} from './fields';
import { VariantEditor } from './VariantEditor';
import { ImagePicker, ImageSelectionInputs, type ImageSelection } from './ImagePicker';
import { MediaUploader } from './MediaUploader';

/**
 * Create/edit form.
 *
 * `useActionState` keeps the result message rendered next to the form after a
 * submit, which matters here because a failed save must not look like a reload.
 * Prices are shown in dollars and converted to cents in the action, matching
 * the `products.price` column and `Money.amount`.
 *
 * One submit writes the product row and then replaces its relations, so a save
 * is all-or-nothing from the editor's point of view.
 */

const PRODUCT_TYPES = [
  { value: 'cleanser', label: 'Cleanser' },
  { value: 'moisturiser', label: 'Moisturiser' },
  { value: 'serum', label: 'Serum' },
  { value: 'toner', label: 'Toner' },
  { value: 'mask', label: 'Mask' },
  { value: 'spf', label: 'SPF' },
];

const BADGE_TONES = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'moss', label: 'Moss' },
  { value: 'clay', label: 'Clay' },
  { value: 'ink', label: 'Ink' },
  { value: 'danger', label: 'Danger' },
];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-ink px-4 py-2 text-sm text-porcelain transition-colors hover:bg-ink-soft disabled:opacity-60"
    >
      {pending ? 'Saving…' : label}
    </button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-danger px-4 py-2 text-sm text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  );
}

function termsOf(taxonomy: AdminTaxonomyGroup[], kind: string) {
  return taxonomy.find((group) => group.kind === kind)?.terms ?? [];
}

interface BadgeDraft {
  key: string;
  label: string;
  tone: string;
}

let badgeCounter = 0;

export function ProductForm({
  product,
  taxonomy,
  media,
  brandName,
}: {
  product: AdminProductDetail | null;
  taxonomy: AdminTaxonomyGroup[];
  media: AdminMedia[];
  brandName: string;
}) {
  const [state, action] = useActionState(saveProduct, null);
  const [removeState, removeAction] = useActionState(removeProduct, null);
  const [variantCount, setVariantCount] = useState(product?.variants.length ?? 0);
  /**
   * Image selection, in state rather than in checkboxes.
   *
   * The uploader below is its own form, so it cannot sit inside this one. That
   * makes the picker a set of form controls with no form to belong to, so the
   * selection lives here and is posted as hidden inputs.
   */
  const [imageSelection, setImageSelection] = useState<ImageSelection>(() => {
    const linked = [...(product?.images ?? [])].sort((a, b) => a.position - b.position);
    const primary = linked.find((image) => image.isPrimary) ?? linked[0];
    return { ids: linked.map((image) => image.imageId), primaryId: primary?.imageId ?? '' };
  });
  /**
   * Ids uploaded since this page was opened, used only to keep the upload panel
   * open and to explain the auto-selection. The selection itself is updated
   * immediately in `handleUpload`, because waiting for `router.refresh()` to
   * re-render the grid would mean deriving state from a prop inside an effect.
   */
  const [justUploaded, setJustUploaded] = useState<string[]>([]);

  /**
   * Attach a freshly uploaded image to the product being edited.
   *
   * The grid is server-rendered, so the new thumbnail only appears after the
   * uploader's `router.refresh()`. Selecting it here rather than reacting to
   * that render is what makes the common case — pick a photo, save the product
   * — work on the first attempt instead of silently saving an empty gallery.
   */
  const handleUpload = (id: string) => {
    setJustUploaded((current) => (current.includes(id) ? current : [...current, id]));
    setImageSelection((current) => {
      if (current.ids.includes(id)) return current;
      const ids = [...current.ids, id];
      return { ids, primaryId: current.primaryId || ids[0] || '' };
    });
  };
  const [badges, setBadges] = useState<BadgeDraft[]>(() =>
    (product?.badges ?? []).map((badge) => ({
      key: badge.id,
      label: badge.label,
      tone: badge.tone,
    })),
  );
  const [keyIngredients, setKeyIngredients] = useState(() =>
    (product?.keyIngredients ?? []).map((entry) => ({
      key: entry.product_id + entry.ingredient_id,
      ingredientId: entry.ingredient_id,
      note: entry.note,
    })),
  );

  const p = product;
  const toDollars = (cents: number) => (cents / 100).toFixed(2);
  const feedback = removeState ?? state;

  const categoryTerms = termsOf(taxonomy, 'category');
  const skinTypeTerms = termsOf(taxonomy, 'skin_type');
  const concernTerms = termsOf(taxonomy, 'skin_concern');
  const ingredientTerms = termsOf(taxonomy, 'ingredient');
  const collectionTerms = termsOf(taxonomy, 'collection');

  const optionsFor = (terms: { id: string; name: string }[]) =>
    terms.map((term) => ({ value: term.id, label: term.name }));

  return (
    <div className="max-w-4xl space-y-8">
      {feedback ? (
        <p
          role="status"
          className={
            feedback.ok
              ? 'rounded-md border border-line bg-success-soft px-4 py-3 text-sm text-success'
              : 'rounded-md border border-line bg-danger-soft px-4 py-3 text-sm text-danger'
          }
        >
          {feedback.message}
        </p>
      ) : null}

      <form action={action} className="space-y-10">
        {p ? <input type="hidden" name="id" value={p.id} /> : null}
        {p ? <input type="hidden" name="existing_variant_count" value={p.variants.length} /> : null}

        <Section title="Identity">
          <Row label="Name" htmlFor="name">
            <input
              id="name"
              name="name"
              required
              maxLength={120}
              defaultValue={p?.name ?? ''}
              className={inputClass}
            />
          </Row>

          <Row label="Slug" htmlFor="slug" hint="Left blank, it is derived from the name.">
            <input
              id="slug"
              name="slug"
              maxLength={80}
              defaultValue={p?.slug ?? ''}
              placeholder="derived from the name when blank"
              className={inputClass}
            />
          </Row>

          <Row label="Subtitle" htmlFor="subtitle">
            <input
              id="subtitle"
              name="subtitle"
              maxLength={200}
              defaultValue={p?.subtitle ?? ''}
              className={inputClass}
            />
          </Row>

          <Row
            label="Brand"
            htmlFor="brand"
            hint={`Shown on the product page. Defaults to the site name, ${brandName}.`}
          >
            <input
              id="brand"
              name="brand"
              maxLength={80}
              defaultValue={p?.brand ?? brandName}
              className={inputClass}
            />
          </Row>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Category"
              htmlFor="category_id"
              name="category_id"
              required
              defaultValue={p?.category_id}
              placeholder="Choose a category"
              options={optionsFor(categoryTerms)}
            />
            <SelectField
              label="Product type"
              htmlFor="product_type"
              name="product_type"
              required
              defaultValue={p?.product_type}
              options={PRODUCT_TYPES}
            />
          </div>
        </Section>

        {/*
          Images sit directly under Identity, not further down the form.
          Adding a photo is the most common edit there is, and it is also the
          first thing anyone checks when they open a product — but below
          Ingredients and Sizes it meant scrolling the length of a page to
          reach the upload control. The product page is built around a name and
          a photograph, so the form reads the same way.
        */}
        <Section
          title="Images"
          description="Tick the images to use and choose which one is primary. The primary image is what appears on cards, in search results, and in the bag."
        >
          {/*
            Uploads live here as well as on the media page. Adding a photo to a
            product is the most common edit there is, and making it a separate
            trip means the operator picks a file, leaves, comes back, and
            remembers which image to select.

            The uploader comes *before* the grid, not after it. The grid renders
            the entire media library, so with a real catalogue it is thousands
            of pixels tall — putting the upload control underneath it meant the
            control the operator came for was the furthest thing from the top of
            the page. Upload first, then choose, which is also the order the
            work happens in.

            The id is remembered so the picker can tick the new image once the
            refresh lands — the grid is server-rendered, so without this the
            image appears but nothing selects it and the product saves with an
            empty gallery.
          */}
          <details
            className="rounded-md border border-line bg-shell p-3"
            open={justUploaded.length > 0}
          >
            <summary className="cursor-pointer text-sm font-medium">+ Upload a product image</summary>
            <div className="mt-3">
              <MediaUploader defaultFolder="products" compact onUploaded={handleUpload} />
            </div>
          </details>

          <ImagePicker
            media={media}
            selection={imageSelection}
            onChange={setImageSelection}
          />

          {/*
            The selection is not submitted by the grid's checkboxes — they are
            plain controls with no form to belong to, since the uploader above
            is a separate form. These hidden inputs are how the choice reaches
            the save.
          */}
          <ImageSelectionInputs selection={imageSelection} />
        </Section>

        <Section title="Copy">
          <Row label="Short description" htmlFor="short_description">
            <input
              id="short_description"
              name="short_description"
              maxLength={400}
              defaultValue={p?.short_description ?? ''}
              className={inputClass}
            />
          </Row>

          <Row label="Description" htmlFor="description">
            <textarea
              id="description"
              name="description"
              rows={8}
              defaultValue={p?.description ?? ''}
              className={inputClass}
            />
          </Row>

          <LineListField
            label="Highlights"
            htmlFor="highlights"
            values={p?.highlights}
            placeholder={'Ceramides at skin-identical levels\nFragrance free'}
          />

          <LineListField
            label="Benefits"
            htmlFor="benefits"
            values={p?.benefits}
            placeholder={'Supports the skin barrier\nReduces the feel of tightness'}
          />

          <LineListField
            label="How to use"
            htmlFor="usage"
            values={p?.usage}
            placeholder={'Apply to damp skin\nUse morning and evening'}
          />
        </Section>

        <Section
          title="Ingredients"
          description="Ingredient text is the visible list. Claims about what an ingredient does belong in the key ingredient notes, where they are attributed to the ingredient rather than to the whole product."
        >
          <Row label="Ingredient list" htmlFor="ingredients_text">
            <textarea
              id="ingredients_text"
              name="ingredients_text"
              rows={5}
              defaultValue={p?.ingredients_text ?? ''}
              className={inputClass}
            />
          </Row>

          <LineListField
            label="Warnings"
            htmlFor="warnings"
            values={p?.warnings ?? undefined}
            hint="Avoid during pregnancy, patch test first, and similar. One per line."
          />

          <fieldset>
            <legend className="text-sm font-medium">Key ingredients</legend>
            <p className="mt-0.5 text-xs text-muted">
              The ingredients shown as cards on the product page, each with a short note.
            </p>

            <div className="mt-3 space-y-2">
              {keyIngredients.map((entry, index) => (
                <div key={entry.key} className="flex flex-wrap items-end gap-2">
                  <label className="min-w-48 flex-1">
                    <span className="sr-only">Ingredient</span>
                    <select
                      name={`key_ingredient_${index}`}
                      value={entry.ingredientId}
                      onChange={(event) =>
                        setKeyIngredients((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, ingredientId: event.target.value } : item,
                          ),
                        )
                      }
                      className={inputClass}
                    >
                      <option value="">Choose an ingredient</option>
                      {ingredientTerms.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="min-w-48 flex-[2]">
                    <span className="sr-only">Note</span>
                    <input
                      name={`key_ingredient_note_${index}`}
                      defaultValue={entry.note}
                      placeholder="What it does for the skin"
                      className={inputClass}
                    />
                  </label>

                  <input type="hidden" name="key_ingredient_count" value={keyIngredients.length} />

                  <button
                    type="button"
                    onClick={() =>
                      setKeyIngredients((current) => current.filter((_, i) => i !== index))
                    }
                    className="rounded-md border border-line px-3 py-2 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setKeyIngredients((current) => [
                    ...current,
                    { key: `ki-${++badgeCounter}`, ingredientId: '', note: '' },
                  ])
                }
                className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-sand"
              >
                Add key ingredient
              </button>
            </div>
          </fieldset>
        </Section>

        <Section
          title="Pricing and stock"
          description="Used when the product has no sizes below. Stock is the count shown when a product is out of stock, so it is kept separate from visibility."
        >
          <div className="grid gap-4 sm:grid-cols-4">
            <Row label="Price" htmlFor="price">
              <input
                id="price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={p ? toDollars(p.price) : ''}
                className={inputClass}
              />
            </Row>

            <Row label="Compare at" htmlFor="compare_at_price">
              <input
                id="compare_at_price"
                name="compare_at_price"
                type="number"
                min="0"
                step="0.01"
                defaultValue={p?.compare_at_price != null ? toDollars(p.compare_at_price) : ''}
                className={inputClass}
              />
            </Row>

            <Row label="Stock" htmlFor="stock_quantity">
              <input
                id="stock_quantity"
                name="stock_quantity"
                type="number"
                min="0"
                step="1"
                defaultValue={p?.stock_quantity ?? 0}
                className={inputClass}
              />
            </Row>

            <Row label="Low stock at" htmlFor="low_stock_threshold">
              <input
                id="low_stock_threshold"
                name="low_stock_threshold"
                type="number"
                min="0"
                step="1"
                defaultValue={p?.low_stock_threshold ?? 5}
                className={inputClass}
              />
            </Row>
          </div>

          <Row
            label="Dispatch estimate"
            htmlFor="dispatch_estimate"
            hint="Shown before dispatch, e.g. 'Ships in 1–2 working days'."
          >
            <input
              id="dispatch_estimate"
              name="dispatch_estimate"
              maxLength={120}
              defaultValue={p?.dispatch_estimate ?? ''}
              className={inputClass}
            />
          </Row>
        </Section>

        <Section title="Sizes and variants">
          <VariantEditor
            variants={p?.variants ?? []}
            productId={p?.id}
            onChange={(rows) => setVariantCount(rows.length)}
          />
          {variantCount > 0 ? (
            <p className="text-xs text-muted">
              {variantCount} {variantCount === 1 ? 'size' : 'sizes'} will be saved.
            </p>
          ) : null}
        </Section>

        <Section title="Who it suits" description="These drive the filter panel and the quiz.">
          <FacetPicker
            legend="Skin types"
            name="skin_type_ids"
            options={skinTypeTerms}
            selected={p?.skinTypeIds ?? []}
          />
          <FacetPicker
            legend="Skin concerns"
            name="skin_concern_ids"
            options={concernTerms}
            selected={p?.skinConcernIds ?? []}
          />
          <FacetPicker
            legend="Ingredients"
            name="ingredient_ids"
            options={ingredientTerms}
            selected={p?.ingredientIds ?? []}
          />
          <FacetPicker
            legend="Featured ingredients"
            name="hero_ingredient_ids"
            options={ingredientTerms}
            selected={p?.heroIngredientIds ?? []}
          />
          <FacetPicker
            legend="Collections"
            name="collection_ids"
            options={collectionTerms}
            selected={p?.collectionIds ?? []}
          />
        </Section>

        <Section title="Badges">
          <div className="space-y-2">
            {badges.map((badge, index) => (
              <div key={badge.key} className="flex flex-wrap items-center gap-2">
                <input
                  name={`badge_label_${index}`}
                  defaultValue={badge.label}
                  placeholder="Label"
                  aria-label="Badge label"
                  className={`${inputClass} max-w-56`}
                />
                <select
                  name={`badge_tone_${index}`}
                  defaultValue={badge.tone}
                  aria-label="Badge tone"
                  className={`${inputClass} max-w-40`}
                >
                  {BADGE_TONES.map((tone) => (
                    <option key={tone.value} value={tone.value}>
                      {tone.label}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="badge_count" value={badges.length} />
                <button
                  type="button"
                  onClick={() => setBadges((current) => current.filter((_, i) => i !== index))}
                  className="rounded-md border border-line px-3 py-2 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setBadges((current) => [
                  ...current,
                  { key: `badge-${++badgeCounter}`, label: '', tone: 'neutral' },
                ])
              }
              className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-sand"
            >
              Add badge
            </button>
          </div>
        </Section>

        <Section
          title="Visibility"
          description="Visible decides whether the product may appear anywhere on the shop. Hidden products keep all their data and stay editable here, but disappear from the homepage, category pages, search, and recommendations."
        >
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox
              name="visible"
              label="Visible on the storefront"
              defaultChecked={p ? Boolean(p.visible) : true}
            />
            <Checkbox
              name="available_for_sale"
              label="Available for sale"
              defaultChecked={p ? Boolean(p.available_for_sale) : true}
            />
          </div>

          {/*
            Stated in the interface because this is the single most common
            "why isn't my product showing?" question, and the answer is not
            visible in any control above it: visibility makes a product
            *eligible*, while a merchandising flag or collection membership is
            what actually places it on a particular page.
          */}
          <p className="rounded-md border border-line bg-porcelain px-3 py-2.5 text-xs leading-relaxed text-muted">
            <strong className="font-medium text-ink">Visible is not the same as featured.</strong>{' '}
            A visible product appears in its category, in search, and wherever you link to it. To
            put one on the <strong className="font-medium text-ink">homepage</strong> you also
            need a flag under Merchandising, or membership of a collection. A visible product with
            neither is simply in the catalogue, not on the front page.
          </p>
        </Section>

        <Section
          title="Merchandising"
          description="These place a product on the homepage. Only mark something as a bestseller once you have real orders to support it."
        >
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox
              name="is_featured"
              label="Featured"
              defaultChecked={p ? Boolean(p.is_featured) : false}
            />
            <Checkbox
              name="is_new_arrival"
              label="New arrival"
              defaultChecked={p ? Boolean(p.is_new_arrival) : false}
            />
            <Checkbox
              name="is_best_seller"
              label="Best seller"
              defaultChecked={p ? Boolean(p.is_best_seller) : false}
            />
          </div>
        </Section>

        <Section title="Search engine listing">
          <Row label="SEO title" htmlFor="seo_title">
            <input
              id="seo_title"
              name="seo_title"
              maxLength={200}
              defaultValue={p?.seo_title ?? ''}
              className={inputClass}
            />
          </Row>

          <Row label="SEO description" htmlFor="seo_description">
            <textarea
              id="seo_description"
              name="seo_description"
              rows={3}
              defaultValue={p?.seo_description ?? ''}
              className={inputClass}
            />
          </Row>
        </Section>

        <div className="flex flex-wrap gap-3 border-t border-line pt-6">
          <SubmitButton label={p ? 'Save changes' : 'Create product'} />
        </div>
      </form>

      {p ? (
        <form action={removeAction} className="border-t border-line pt-6">
          <input type="hidden" name="id" value={p.id} />
          <p className="mb-3 text-sm text-muted">
            Deleting removes the product and its sizes, images, badges, and facet links. Past
            orders keep their record of what was bought.
          </p>
          <DeleteButton />
        </form>
      ) : null}
    </div>
  );
}
