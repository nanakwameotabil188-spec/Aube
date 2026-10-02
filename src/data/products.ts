import type { Money, Product, ProductBadge, ProductType, RatingSummary } from '@/types';
import { storeSettings } from './settings';
import { money } from '@/lib/utils/format';
import { photo, photoAt } from './media';

/**
 * Product catalog.
 *
 * Records are written the way an admin panel or a database would return
 * them: explicit ids, explicit ordering, explicit money in minor units and
 * images as structured objects. Nothing here is referenced by index from
 * elsewhere in the app.
 */

const DEFAULT_UPDATED = '2026-09-14T10:00:00.000Z';

interface Spec {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  shortDescription: string;
  description: string;
  highlights: string[];
  price: number;
  compareAt?: number;
  size: string;
  categoryId: string;
  productType: ProductType;
  collectionIds: string[];
  skinTypeIds: string[];
  skinConcernIds: string[];
  ingredientIds: string[];
  heroIngredientIds?: string[];
  benefits: string[];
  usage: string[];
  ingredients: string;
  keyIngredients: { ingredientId: string; note: string }[];
  warnings?: string[];
  /** Pexels photo ids for the gallery, in display order. */
  gallery: [number, string][];
  /**
   * Catalogue seed may carry a rating, but nothing in the seed data does: a
   * rating is only ever derived from approved customer reviews, and there are
   * none yet. Left optional so the storefront renders "no reviews" honestly
   * rather than inventing one.
   */
  rating?: RatingSummary;
  badges?: [string, ProductBadge['tone']][];
  stock: number;
  lowStockThreshold?: number;
  availableForSale?: boolean;
  dispatchEstimate?: string;
  variants?: { name: string; size: string; price: number; compareAt?: number; stock: number }[];
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  relatedProductIds?: string[];
  frequentlyBoughtWithIds?: string[];
  position: number;
  createdAt: string;
  updatedAt?: string;
}

function makeProduct(spec: Spec): Product {
  const price = money(spec.price * 100);
  const compareAtPrice = spec.compareAt ? money(spec.compareAt * 100) : undefined;
  // No seed product carries reviews, so every one starts with an empty rating.
  // `average` stays null until a real review is approved.
  const rating: RatingSummary = spec.rating ?? {
    average: null,
    count: 0,
    distribution: [0, 0, 0, 0, 0],
  };

  const images = spec.gallery.map(([id, alt], index) =>
    index === 0 ? photo(id, alt, 0, true) : photoAt(id, alt, index),
  );
  const thumbnail = images[0]!;

  const variants = (
    spec.variants ?? [{ name: 'Standard', size: spec.size, price: spec.price, compareAt: spec.compareAt, stock: spec.stock }]
  ).map((variant, index) => ({
    id: `${spec.id}-v${index + 1}`,
    // The full slug, not a prefix of it. A truncated SKU collides the moment
    // two products share a first word — `cleansing-balm` and `cleansing-brush`
    // both became `AUBE-CLEANSINGB-1` — and a SKU is a business key that has
    // to stay unique across the catalogue.
    sku: `${storeSettings.brandCode}-${spec.slug.toUpperCase().replace(/-/g, '')}-${index + 1}`,
    name: variant.name,
    size: variant.size,
    price: money(variant.price * 100),
    compareAtPrice: variant.compareAt ? money(variant.compareAt * 100) : undefined,
    stockQuantity: variant.stock,
    position: index + 1,
    isDefault: index === 0,
  }));

  return {
    id: spec.id,
    slug: spec.slug,
    name: spec.name,
    subtitle: spec.subtitle,
    // Product brand comes from settings so a rename reaches the catalogue
    // facets and JSON-LD, not just the header and footer.
    brand: storeSettings.brandName,
    shortDescription: spec.shortDescription,
    description: spec.description,
    highlights: spec.highlights,
    price,
    compareAtPrice,
    currency: storeSettings.currency,
    images,
    thumbnail,
    categoryId: spec.categoryId,
    productType: spec.productType,
    collectionIds: spec.collectionIds,
    skinTypeIds: spec.skinTypeIds,
    skinConcernIds: spec.skinConcernIds,
    ingredientIds: spec.ingredientIds,
    heroIngredientIds: spec.heroIngredientIds ?? [],
    benefits: spec.benefits,
    usage: spec.usage,
    ingredients: spec.ingredients,
    keyIngredients: spec.keyIngredients,
    warnings: spec.warnings,
    size: spec.size,
    variants,
    stockQuantity: spec.stock,
    availableForSale: spec.availableForSale ?? true,
    lowStockThreshold: spec.lowStockThreshold ?? 8,
    dispatchEstimate: spec.dispatchEstimate ?? 'Dispatches within 1–2 working days',
    rating,
    badges: (spec.badges ?? []).map(([label, tone], index) => ({
      id: `${spec.id}-badge-${index + 1}`,
      label,
      tone,
      position: index + 1,
    })),
    isFeatured: spec.isFeatured ?? false,
    isBestSeller: spec.isBestSeller ?? false,
    isNewArrival: spec.isNewArrival ?? false,
    relatedProductIds: spec.relatedProductIds ?? [],
    frequentlyBoughtWithIds: spec.frequentlyBoughtWithIds ?? [],
    position: spec.position,
    status: 'active',
    visible: true,
    createdAt: spec.createdAt,
    updatedAt: spec.updatedAt ?? DEFAULT_UPDATED,
    seo: {
      title: `${spec.name} — ${spec.subtitle}`,
      description: spec.shortDescription,
      canonicalPath: `/products/${spec.slug}`,
    },
  };
}

export const products: Product[] = [
  /* ---------------- Cleansers ---------------- */
  makeProduct({
    id: 'prod-softening-milk-cleanser',
    slug: 'softening-milk-cleanser',
    name: 'Softening Milk Cleanser',
    subtitle: 'A cushiony, low-foam daily cleanse',
    shortDescription:
      'A pH 5.5 milk cleanser that removes sunscreen and makeup residue without leaving skin tight.',
    description:
      'Most cleansers are formulated to feel squeaky, which is exactly the wrong sensation: it usually means the barrier has been stripped. This is a low-foam milk that emulsifies sunscreen, SPF residue and light makeup, then rinses with nothing more than lukewarm water.\n\nThe finish matters as much as the removal. Skin is left at its natural pH with no tight, papery feeling, which makes it safe to use twice a day without compromise.',
    highlights: [
      'Removes SPF 50 and light makeup in one pass',
      'pH 5.5 — matched to the acid mantle',
      'Sulfate-free, fragrance-free',
    ],
    price: 38,
    size: '150 ml',
    categoryId: 'cat-cleansers',
    productType: 'cleanser',
    collectionIds: ['col-essentials', 'col-sensitive-simplified', 'col-barrier-ritual'],
    skinTypeIds: ['st-normal', 'st-dry', 'st-sensitive', 'st-combination'],
    skinConcernIds: ['sc-dehydration', 'sc-barrier-damage', 'sc-redness'],
    ingredientIds: ['ing-panthenol', 'ing-centella', 'ing-glycerin', 'ing-oat'],
    heroIngredientIds: ['ing-panthenol'],
    benefits: [
      'Removes sunscreen without a second cleanse',
      'Leaves skin at its natural pH',
      'Safe for twice-daily use',
      'No residue under makeup',
    ],
    usage: [
      'Warm a pea-sized amount between dry hands.',
      'Massage over dry skin for 30 seconds, focusing on areas with SPF.',
      'Add water to emulsify, then rinse thoroughly.',
    ],
    ingredients:
      'Aqua, Glycerin, Caprylic/Capric Triglyceride, Cetearyl Alcohol, PEG-100 Stearate, Panthenol, Centella Asiatica Extract, Avena Sativa Kernel Extract, Sodium Hyaluronate, Xanthan Gum, Citric Acid, Sodium Benzoate, Potassium Sorbate.',
    keyIngredients: [
      { ingredientId: 'ing-panthenol', note: 'Supports barrier recovery during cleansing' },
      { ingredientId: 'ing-centella', note: 'Calms residual irritation' },
    ],
    gallery: [
      [7303922, 'Two white pump bottles on a plain minimal background'],
      [10221846, 'A hand reaching for skincare products on a modern bathroom sink'],
      [7691164, 'Clean display of skincare products on a white surface with a towel backdrop'],
    ],
    badges: [['Featured', 'moss']],
    stock: 240,
    isBestSeller: true,
    isFeatured: true,
    relatedProductIds: ['prod-hydrating-essence', 'prod-barrier-cream', 'prod-mineral-shield'],
    frequentlyBoughtWithIds: ['prod-hydrating-essence', 'prod-weightless-lotion'],
    position: 1,
    createdAt: '2025-11-14T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-rich-cream-cleanser',
    slug: 'rich-cream-cleanser',
    name: 'Rich Cream Cleanser',
    subtitle: 'A balm-milk for dry and mature skin',
    shortDescription:
      'A nourishing cream cleanser that removes impurities while preserving the lipids dry skin depends on.',
    description:
      'Dry and mature skin loses lipid density with age, and any cleanser that ignores this accelerates the problem. This is a cream texture with a high oil-to-water ratio, designed to clean without contributing to transepidermal water loss.\n\nIt melts on contact, emulsifies with water into a light lotion, and rinses clean. Skin is left soft rather than squeaky — which is the correct sensation.',
    highlights: [
      'Oil-rich base that respects a depleted barrier',
      'Removes heavier makeup in a single cleanse',
      'Leaves skin soft, never tight',
    ],
    price: 42,
    size: '120 ml',
    categoryId: 'cat-cleansers',
    productType: 'cleanser',
    collectionIds: ['col-barrier-ritual', 'col-essentials'],
    skinTypeIds: ['st-dry', 'st-normal', 'st-sensitive'],
    skinConcernIds: ['sc-barrier-damage', 'sc-dehydration', 'sc-firmness'],
    ingredientIds: ['ing-squalane', 'ing-ceramides', 'ing-panthenol'],
    heroIngredientIds: ['ing-squalane', 'ing-ceramides'],
    benefits: [
      'Preserves barrier lipids while cleansing',
      'Softens rough, flaking texture',
      'Removes heavier makeup in one step',
      'Ideal as a second cleanse',
    ],
    usage: [
      'Massage a generous amount over dry skin.',
      'Work in slow circles for 60 seconds.',
      'Emulsify with warm water and rinse.',
    ],
    ingredients:
      'Aqua, Glycerin, Caprylic/Capric Triglyceride, Cetearyl Alcohol, Squalane, Cetyl Phosphate, Sodium Hyaluronate, Ceramide NP, Panthenol, Tocopherol, Xanthan Gum, Sodium Benzoate, Potassium Sorbate.',
    keyIngredients: [
      { ingredientId: 'ing-squalane', note: 'Oxidation-resistant emollient' },
      { ingredientId: 'ing-ceramides', note: 'Lipid support for depleted skin' },
    ],
    gallery: [
      [4202326, 'Cosmetic containers for cream arranged on a marble shelf in a beige bathroom'],
      [3785147, 'Luxury skincare products arranged on a warm soft surface'],
      [7691161, 'Elegant close-up of white cosmetic containers in a minimalist setting'],
    ],
    stock: 96,
    isFeatured: true,
    relatedProductIds: ['prod-barrier-serum', 'prod-lipid-recovery-oil', 'prod-night-repair-cream'],
    frequentlyBoughtWithIds: ['prod-barrier-serum', 'prod-night-repair-cream'],
    position: 2,
    createdAt: '2025-11-20T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-clarifying-gel-cleanser',
    slug: 'clarifying-gel-cleanser',
    name: 'Clarifying Gel Cleanser',
    subtitle: '2% salicylic acid, twice a day',
    shortDescription:
      'A low-pH gel with 2% BHA that clears pores without stripping the skin that surrounds them.',
    description:
      'Salicylic acid is the only oil-soluble exfoliant, which is precisely why it works inside a pore rather than on top of one. At 2% it is effective as a daily treatment rather than a weekly scrub.\n\nThe gel base is buffered to pH 4.5 and cushioned with panthenol, so the exfoliation happens without the tight, squeaky aftermath that usually accompanies BHA cleansers.',
    highlights: [
      '2% salicylic acid — daily strength, not a scrub',
      'Oil-soluble, so it clears inside the pore',
      'Buffered to pH 4.5 with panthenol cushioning',
    ],
    price: 36,
    size: '150 ml',
    categoryId: 'cat-cleansers',
    productType: 'cleanser',
    collectionIds: ['col-essentials'],
    skinTypeIds: ['st-oily', 'st-combination', 'st-normal'],
    skinConcernIds: ['sc-breakouts', 'sc-congestion', 'sc-texture'],
    ingredientIds: ['ing-niacinamide', 'ing-green-tea', 'ing-panthenol'],
    heroIngredientIds: ['ing-niacinamide', 'ing-green-tea'],
    benefits: [
      'Clears congestion and blackheads',
      'Refines the appearance of pores',
      'Safe for daily use at 2%',
      'Cushioned against irritation',
    ],
    usage: [
      'Massage over damp skin for 30 seconds.',
      'Rinse with lukewarm water.',
      'Use morning and evening. Introduce every other day if you are new to BHA.',
    ],
    ingredients:
      'Aqua, Sodium Cocoyl Isethionate, Glycerin, Niacinamide, Salicylic Acid, Camellia Sinensis Leaf Extract, Panthenol, Zinc PCA, Guar Hydroxypropyltrimonium Chloride, Citric Acid, Sodium Benzoate, Potassium Sorbate.',
    keyIngredients: [
      { ingredientId: 'ing-niacinamide', note: 'Regulates sebum alongside the BHA' },
      { ingredientId: 'ing-green-tea', note: 'Antioxidant with sebum-reducing evidence' },
    ],
    warnings: ['Not recommended during pregnancy without medical advice.'],
    gallery: [
      [7005933, 'Top view of a minimalist olive green cosmetic tube on textured brown paper'],
      [7670694, 'Simple minimalist arrangement of cosmetic bottles on a grey background'],
      [6690828, 'Elegant minimalist arrangement of spa essentials on a marble surface'],
    ],
    stock: 312,
    isBestSeller: true,
    relatedProductIds: ['prod-niacinamide-serum', 'prod-mineral-clay-mask', 'prod-weightless-lotion'],
    frequentlyBoughtWithIds: ['prod-niacinamide-serum', 'prod-mineral-shield'],
    position: 3,
    createdAt: '2025-12-02T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-cleansing-balm',
    slug: 'cleansing-balm-no-1',
    name: 'Cleansing Balm No. 1',
    subtitle: 'Melts SPF, makeup and the day',
    shortDescription:
      'A sherbet balm that dissolves a full day of sunscreen and makeup, then rinses without a film.',
    description:
      'Waterproof sunscreens and long-wear makeup need an oil-based first cleanse. This is a sherbet balm that melts on contact with skin temperature, binds the makeup and SPF, and emulsifies into a light milk when water is added.\n\nIt rinses completely. No residue, no film, and nothing left behind to interfere with the serum that follows.',
    highlights: [
      'Removes waterproof SPF and long-wear makeup',
      'Rinses fully — no film, no residue',
      'Suitable as a first step in a double cleanse',
    ],
    price: 48,
    size: '100 ml',
    categoryId: 'cat-cleansers',
    productType: 'cleanser',
    collectionIds: ['col-vitamin-c-brightening', 'col-essentials'],
    skinTypeIds: ['st-dry', 'st-normal', 'st-combination'],
    skinConcernIds: ['sc-congestion', 'sc-dullness'],
    ingredientIds: ['ing-squalane', 'ing-green-tea'],
    heroIngredientIds: ['ing-squalane'],
    benefits: [
      'Dissolves waterproof sunscreen and makeup',
      'Emulsifies and rinses completely',
      'Leaves skin supple, not slick',
    ],
    usage: [
      'Scoop a hazelnut-sized amount onto dry skin.',
      'Massage for 60 seconds until the balm turns to oil.',
      'Add water to emulsify, then rinse thoroughly.',
    ],
    ingredients:
      'Squalane, Ethylhexyl Palmitate, Caprylic/Capric Triglyceride, PEG-20 Glyceryl Triisostearate, Camellia Sinensis Leaf Extract, Tocopherol, Rosmarinus Officinalis Leaf Extract.',
    keyIngredients: [{ ingredientId: 'ing-squalane', note: 'The base emollient, fully oxidation-resistant' }],
    gallery: [
      [8015461, 'Minimalist white cosmetic containers with soft shadows'],
      [6167867, 'Minimalist skincare bottle with an autumn leaf on marble'],
      [7814941, 'Minimalist skincare bottle with a rock on dark marble'],
    ],
    stock: 74,
    relatedProductIds: ['prod-softening-milk-cleanser', 'prod-vitamin-c-serum', 'prod-midnight-oil'],
    frequentlyBoughtWithIds: ['prod-vitamin-c-serum', 'prod-invisible-fluid-spf'],
    position: 4,
    createdAt: '2026-01-08T09:00:00.000Z',
  }),

  /* ---------------- Essences & toners ---------------- */
  makeProduct({
    id: 'prod-hydrating-essence',
    slug: 'hydrating-essence',
    name: 'Hydrating Essence',
    subtitle: 'Five weights of hyaluronic acid',
    shortDescription:
      'A lightly viscous, alcohol-free essence that leaves a reservoir of water for everything that follows.',
    description:
      'Multi-weight hyaluronic acid works at several depths of the upper epidermis at once, which is why a blend outperforms any single molecular weight. This essence is deliberately light: it should feel like water, not like a serum.\n\nIt also carries panthenol and a small amount of glycerin, so the hydration it delivers stays in place rather than evaporating before the next step.',
    highlights: [
      'Five molecular weights of hyaluronic acid',
      'Alcohol-free, lightly viscous, no tackiness',
      'A hydration reservoir for serum and cream',
    ],
    price: 44,
    size: '150 ml',
    categoryId: 'cat-essences',
    productType: 'essence',
    collectionIds: ['col-dew', 'col-barrier-ritual', 'col-essentials', 'col-sensitive-simplified'],
    skinTypeIds: ['st-dry', 'st-normal', 'st-sensitive', 'st-oily', 'st-combination'],
    skinConcernIds: ['sc-dehydration', 'sc-barrier-damage', 'sc-dullness'],
    ingredientIds: ['ing-hyaluronic', 'ing-panthenol', 'ing-beta-glucan'],
    heroIngredientIds: ['ing-hyaluronic'],
    benefits: [
      'Plumps the appearance of dehydration lines',
      'Improves absorption of everything applied after',
      'Safe for use on reactive skin',
    ],
    usage: [
      'Pat a small amount into freshly cleansed skin.',
      'Follow immediately with a serum while the skin is still damp.',
    ],
    ingredients:
      'Aqua, Glycerin, Sodium Hyaluronate, Hydrolyzed Sodium Hyaluronate, Panthenol, Beta-Glucan, Allantoin, Betaine, Citric Acid, Sodium Benzoate, Potassium Sorbate.',
    keyIngredients: [
      { ingredientId: 'ing-hyaluronic', note: 'Five weights, working at several depths' },
      { ingredientId: 'ing-panthenol', note: 'Keeps the hydration in place' },
    ],
    gallery: [
      [8101150, 'Minimalist skincare display with dropper bottles on a soft surface with wooden accents'],
      [6621461, 'Overhead view of cosmetic bottles on a white marble table with salt'],
      [7691162, 'Elegant display of skincare products in a minimalist natural setting'],
    ],
    badges: [['Featured', 'moss']],
    stock: 410,
    lowStockThreshold: 40,
    isBestSeller: true,
    isFeatured: true,
    relatedProductIds: ['prod-niacinamide-serum', 'prod-barrier-cream', 'prod-weightless-lotion'],
    frequentlyBoughtWithIds: ['prod-niacinamide-serum', 'prod-barrier-cream'],
    position: 5,
    createdAt: '2025-11-14T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-rice-water-toner',
    slug: 'softening-rice-water-toner',
    name: 'Softening Rice Water Toner',
    subtitle: 'Alcohol-free, pH 5.5, no sting',
    shortDescription:
      'A gentle amino-acid toner that softens and smooths without the tightness of a traditional toner.',
    description:
      'Traditional toners rely on alcohol or high-strength acids to create a temporary tightening sensation. That sensation is dehydration, not cleansing.\n\nThis uses fermented rice water and a blend of amino acids to soften the corneocyte surface, at a pH matched to the skin so it supports rather than disrupts the barrier.',
    highlights: [
      'Zero alcohol, zero fragrance',
      'pH 5.5, matched to the acid mantle',
      'Softens texture without drying',
    ],
    price: 32,
    size: '200 ml',
    categoryId: 'cat-essences',
    productType: 'essence',
    collectionIds: ['col-sensitive-simplified', 'col-barrier-ritual', 'col-dew'],
    skinTypeIds: ['st-sensitive', 'st-dry', 'st-normal', 'st-combination'],
    skinConcernIds: ['sc-redness', 'sc-barrier-damage', 'sc-texture'],
    ingredientIds: ['ing-centella', 'ing-panthenol', 'ing-oat'],
    heroIngredientIds: ['ing-centella'],
    benefits: [
      'Softens the feel of rough texture',
      'Cushions against active irritation',
      'Safe immediately after exfoliation',
    ],
    usage: [
      'Pour into the palm and press onto the face and neck.',
      'Follow with a serum while the skin is damp.',
    ],
    ingredients:
      'Aqua, Oryza Sativa (Rice) Ferment Filtrate, Glycerin, Centella Asiatica Extract, Avena Sativa Kernel Extract, Panthenol, Allantoin, Sodium Hyaluronate, Citric Acid, Sodium Benzoate, Potassium Sorbate.',
    keyIngredients: [{ ingredientId: 'ing-centella', note: 'The calming fraction in the ferment base' }],
    gallery: [
      [8015764, 'Cosmetic pump bottles and bath accessories on a textured cloth'],
      [7691112, 'Minimalist arrangement of white skincare products and towels'],
      [10574130, 'Elegant bathroom setup with cosmetic bottles and a basket of toiletries'],
    ],
    stock: 168,
    relatedProductIds: ['prod-centella-serum', 'prod-barrier-cream', 'prod-softening-milk-cleanser'],
    frequentlyBoughtWithIds: ['prod-centella-serum', 'prod-barrier-cream'],
    position: 6,
    createdAt: '2025-12-10T09:00:00.000Z',
  }),

  /* ---------------- Serums ---------------- */
  makeProduct({
    id: 'prod-vitamin-c-serum',
    slug: 'vitamin-c-15-serum',
    name: 'Vitamin C 15% Serum',
    subtitle: 'L-ascorbic acid + ferulic acid, pH 3.3',
    shortDescription:
      'A stabilised 15% vitamin C serum for brightness, pigment and the free radicals SPF cannot stop.',
    description:
      'Vitamin C is effective only in a narrow window: below pH 3.5, in a mostly water-based vehicle, and protected from air and light. Most formulas on the shelf fail at least one of those, which is why they oxidise orange within weeks.\n\nThis one is buffered to pH 3.3, paired with ferulic acid and vitamin E for photostability, and filled into an opaque airless pump. The colour stays pale for the full six months of the open date printed on the base.\n\nExpect visible change in tone at four to six weeks, and a noticeable difference in how your SPF performs alongside it.',
    highlights: [
      '15% L-ascorbic acid, buffered to pH 3.3',
      'Stabilised with ferulic acid and vitamin E',
      'Opaque airless pump — no oxidation, no guessing',
    ],
    price: 78,
    compareAt: 92,
    size: '30 ml',
    categoryId: 'cat-serums',
    productType: 'serum',
    collectionIds: ['col-vitamin-c-brightening', 'col-essentials'],
    skinTypeIds: ['st-normal', 'st-combination', 'st-oily', 'st-dry'],
    skinConcernIds: ['sc-dullness', 'sc-dark-spots', 'sc-fine-lines'],
    ingredientIds: ['ing-vitamin-c', 'ing-ferulic', 'ing-hyaluronic', 'ing-vitamin-e'],
    heroIngredientIds: ['ing-vitamin-c'],
    benefits: [
      'Evens tone and fades post-inflammatory marks',
      'Neutralises the free radicals sunscreen misses',
      'Improves the protection provided by your SPF',
      'Supports collagen synthesis',
    ],
    usage: [
      'Apply 3–4 drops to clean, dry skin each morning.',
      'Wait 60 seconds before the next product so it can absorb.',
      'Follow with a moisturiser and SPF. Always SPF.',
      'Start every other day for the first two weeks if you are new to vitamin C.',
    ],
    ingredients:
      'Aqua, L-Ascorbic Acid, Propylene Glycol, Glycerin, Ethoxydiglycol, Sodium Hyaluronate, Ferulic Acid, Tocopherol, Sodium Citrate, Triethanolamine, Phenoxyethanol, Ethylhexylglycerin.',
    keyIngredients: [
      { ingredientId: 'ing-vitamin-c', note: '15% L-ascorbic acid at working pH' },
      { ingredientId: 'ing-vitamin-e', note: 'Extends the stability of the ascorbic acid' },
    ],
    warnings: [
      'May tingle on very reactive skin for the first few applications.',
      'Introduce gradually, and do not layer with direct acids in the same routine.',
    ],
    variants: [
      { name: 'Standard', size: '30 ml', price: 78, compareAt: 92, stock: 186 },
      { name: 'Large', size: '50 ml', price: 118, stock: 64 },
    ],
    gallery: [
      [4119559, 'Four vitamin C serum bottles arranged on a white background'],
      [8101534, 'Minimalist still life of a serum bottle with a dropper casting artistic shadows'],
      [4735943, 'Elegant glass serum bottle on a white surface with flowers'],
    ],
    badges: [['Featured', 'moss'], ['15% off', 'clay']],
    stock: 186,
    isBestSeller: true,
    isFeatured: true,
    isNewArrival: true,
    relatedProductIds: ['prod-azelaic-serum', 'prod-mineral-shield', 'prod-peptide-serum'],
    frequentlyBoughtWithIds: ['prod-mineral-shield', 'prod-barrier-cream'],
    position: 7,
    createdAt: '2026-02-04T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-niacinamide-serum',
    slug: 'niacinamide-10-zinc-serum',
    name: 'Niacinamide 10% + Zinc',
    subtitle: 'Refines texture, regulates oil',
    shortDescription:
      'The most versatile active in dermatology, at the concentration where it works, buffered for comfort.',
    description:
      'Niacinamide does four useful things at once: it supports barrier lipids, regulates sebum, reduces the appearance of pores, and slows the transfer of pigment to surface cells. That breadth is why it appears in so many routines simultaneously.\n\nAt 10% it is at the upper end of what is useful — beyond that, irritation rises without added benefit. This formula is buffered to pH 5 and paired with 1% zinc PCA for sebum regulation.',
    highlights: [
      '10% niacinamide — useful ceiling, not more',
      '1% zinc PCA for sebum regulation',
      'Buffered to pH 5 for daily tolerance',
    ],
    price: 52,
    size: '30 ml',
    categoryId: 'cat-serums',
    productType: 'serum',
    collectionIds: ['col-essentials', 'col-barrier-ritual', 'col-dew'],
    skinTypeIds: ['st-oily', 'st-combination', 'st-normal', 'st-sensitive', 'st-dry'],
    skinConcernIds: ['sc-breakouts', 'sc-congestion', 'sc-dullness', 'sc-dark-spots', 'sc-barrier-damage'],
    ingredientIds: ['ing-niacinamide', 'ing-zinc-pca', 'ing-panthenol', 'ing-hyaluronic'],
    heroIngredientIds: ['ing-niacinamide'],
    benefits: [
      'Visibly refines pores over eight weeks',
      'Regulates midday shine',
      'Supports the barrier alongside other actives',
      'Slows pigment transfer to surface cells',
    ],
    usage: [
      'Apply 3–4 drops morning and evening, or once daily if you prefer.',
      'Layer before moisturiser. Compatible with most routines.',
    ],
    ingredients:
      'Aqua, Niacinamide, Glycerin, Zinc PCA, Sodium Hyaluronate, Panthenol, Allantoin, Betaine, Xanthan Gum, Citric Acid, Sodium Benzoate, Potassium Sorbate.',
    keyIngredients: [
      { ingredientId: 'ing-niacinamide', note: '10%, buffered to pH 5' },
      { ingredientId: 'ing-panthenol', note: 'Cushions the routine for reactive skin' },
    ],
    gallery: [
      [8101529, 'Still life of a minimalist cosmetic dropper bottle with shadow play'],
      [8054400, 'Sophisticated amber glass bottle with a dropper on a light background'],
      [12146904, 'Close-up of elegant brown and yellow glass bottles with droppers'],
    ],
    badges: [['Featured', 'moss']],
    stock: 520,
    isBestSeller: true,
    isFeatured: true,
    relatedProductIds: ['prod-clarifying-gel-cleanser', 'prod-retinal-serum', 'prod-weightless-lotion'],
    frequentlyBoughtWithIds: ['prod-clarifying-gel-cleanser', 'prod-weightless-lotion'],
    position: 8,
    createdAt: '2025-11-14T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-retinal-serum',
    slug: 'retinal-01-emulsion',
    name: 'Retinal 0.1% Emulsion',
    subtitle: 'Twelve weeks to visibly smoother',
    shortDescription:
      'Retinaldehyde at 0.1% in an oil-in-water emulsion — a retinoid, without tretinoin’s irritation.',
    description:
      'Retinal sits one step from tretinoin: it binds directly to retinoid receptors without the peeling that stops most people persisting. The emulsion is oil-in-water so it layers under moisturiser, and the concentration is set at 0.1% deliberately.\n\nRetinal fails far more often from poor buffering than from poor potency.',
    highlights: [
      '0.1% retinaldehyde — the sustainable dose',
      'Oil-in-water emulsion that layers under cream',
      'Third-party tested, 0% animal testing',
    ],
    price: 96,
    size: '30 ml',
    categoryId: 'cat-serums',
    productType: 'serum',
    collectionIds: ['col-retinal-repair', 'col-barrier-ritual'],
    skinTypeIds: ['st-normal', 'st-combination', 'st-oily', 'st-dry'],
    skinConcernIds: ['sc-fine-lines', 'sc-texture', 'sc-firmness', 'sc-breakouts'],
    ingredientIds: ['ing-retinal', 'ing-squalane', 'ing-niacinamide', 'ing-peptides'],
    heroIngredientIds: ['ing-retinal'],
    benefits: [
      'Softens the appearance of fine lines',
      'Refines texture and pore appearance',
      'Stimulates collagen over eight to twelve weeks',
      'Reduces the frequency of congestion',
    ],
    usage: [
      'Apply 2 drops to completely dry skin at night, after cleansing.',
      'Wait 60 seconds, then follow with a moisturiser.',
      'Start two nights a week and build to nightly over three weeks.',
      'Do not use in the same routine as direct acids. Sunscreen the following morning is essential.',
    ],
    ingredients:
      'Aqua, Glycerin, Caprylic/Capric Triglyceride, Squalane, Retinal, Niacinamide, Cetearyl Alcohol, Glyceryl Stearate, Sodium Hyaluronate, Palmitoyl Tripeptide-1, Tocopherol, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.',
    keyIngredients: [
      { ingredientId: 'ing-retinal', note: '0.1% retinaldehyde in an oil-in-water base' },
      { ingredientId: 'ing-squalane', note: 'Lipid support to buffer the retinoid' },
      { ingredientId: 'ing-peptides', note: 'Supports collagen signalling alongside the retinal' },
    ],
    warnings: [
      'Not suitable during pregnancy or breastfeeding.',
      'Do not use on the same night as glycolic, lactic or mandelic acid.',
      'Expect an adjustment period of two to three weeks. Retinisation is normal; raw, fissured skin is not.',
    ],
    gallery: [
      [6801176, 'A dropper bottle of oil on a tray with a beige background'],
      [8100691, 'Elegant glass skincare bottles with labels on a textured fabric'],
      [7670680, 'Elegant minimalist shot of skincare product containers on a grey background'],
    ],
    badges: [['Routine Builder', 'ink']],
    stock: 58,
    lowStockThreshold: 12,
    isFeatured: true,
    relatedProductIds: ['prod-night-repair-cream', 'prod-peptide-serum', 'prod-mineral-shield'],
    frequentlyBoughtWithIds: ['prod-night-repair-cream', 'prod-barrier-cream'],
    position: 9,
    createdAt: '2025-12-18T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-barrier-serum',
    slug: 'ceramide-repair-serum',
    name: 'Ceramide Repair Serum',
    subtitle: 'The mortar between the bricks',
    shortDescription:
      'Ceramide, cholesterol and fatty acid lipids in skin’s own ratio — the core of barrier repair.',
    description:
      'The stratum corneum is held together by a lipid matrix of ceramides, free fatty acids and cholesterol, in a ratio of roughly 3:1:1 by mass. Damage to that matrix is what "barrier damage" actually means.\n\nThis serum delivers all three lipids in that ratio, at a concentration high enough to matter, in a vehicle light enough to layer under anything. It is the first step we recommend for skin that stings, flakes or has been over-exfoliated.',
    highlights: [
      'Ceramides, cholesterol and fatty acids at 3:1:1',
      'Light enough to layer under any moisturiser',
      'The first step for over-exfoliated or compromised skin',
    ],
    price: 68,
    size: '30 ml',
    categoryId: 'cat-serums',
    productType: 'serum',
    collectionIds: ['col-barrier-ritual', 'col-sensitive-simplified', 'col-dew'],
    skinTypeIds: ['st-dry', 'st-sensitive', 'st-normal', 'st-combination'],
    skinConcernIds: ['sc-barrier-damage', 'sc-dehydration', 'sc-redness'],
    ingredientIds: ['ing-ceramides', 'ing-niacinamide', 'ing-panthenol', 'ing-squalane'],
    heroIngredientIds: ['ing-ceramides'],
    benefits: [
      'Reduces transepidermal water loss',
      'Relieves tightness and flaking',
      'Calms reactive skin',
      'Shortens retinoid adjustment periods',
    ],
    usage: [
      'Apply 3 drops to clean, slightly damp skin, morning and evening.',
      'Follow with a cream. In the evening, layer before a retinoid.',
    ],
    ingredients:
      'Aqua, Glycerin, Ceramide NP, Ceramide AP, Ceramide EOP, Phytosphingosine, Cholestrol, Niacinamide, Squalane, Panthenol, Sodium Hyaluronate, Xanthan Gum, Sodium Benzoate, Potassium Sorbate.',
    keyIngredients: [
      { ingredientId: 'ing-ceramides', note: 'Three ceramide types in skin’s own ratio' },
      { ingredientId: 'ing-niacinamide', note: 'Supports the barrier it is helping rebuild' },
    ],
    gallery: [
      [12146904, 'Close-up of elegant brown and yellow glass bottles with droppers'],
      [7691166, 'Elegant display of skincare products on a white surface'],
      [7691098, 'Elegant white skincare products arranged on a light background'],
    ],
    badges: [['Featured', 'moss']],
    stock: 226,
    isBestSeller: true,
    isFeatured: true,
    relatedProductIds: ['prod-barrier-cream', 'prod-rich-cream-cleanser', 'prod-centella-serum'],
    frequentlyBoughtWithIds: ['prod-barrier-cream', 'prod-softening-milk-cleanser'],
    position: 10,
    createdAt: '2025-11-22T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-peptide-serum',
    slug: 'peptide-firming-serum',
    name: 'Peptide Firming Serum',
    subtitle: 'Nine peptides across three functional classes',
    shortDescription:
      'A collagen-signalling peptide complex across three functional classes.',
    description:
      'Peptides are short amino-acid chains that skin reads as signalling. This is a nine-peptide complex spanning collagen signalling, carrier and copper-binding functions, at concentrations chosen from the published ranges rather than the marketing ranges.',
    highlights: [
      'Nine peptides across three functional classes',
      'Concentrations chosen from published peptide ranges, not marketing ranges',
      'Layers safely with retinal and vitamin C',
    ],
    price: 86,
    size: '30 ml',
    categoryId: 'cat-serums',
    productType: 'serum',
    collectionIds: ['col-retinal-repair', 'col-barrier-ritual'],
    skinTypeIds: ['st-dry', 'st-normal', 'st-sensitive', 'st-combination'],
    skinConcernIds: ['sc-firmness', 'sc-fine-lines', 'sc-texture'],
    ingredientIds: ['ing-peptides', 'ing-hyaluronic', 'ing-ceramides', 'ing-squalane'],
    heroIngredientIds: ['ing-peptides'],
    benefits: [
      'Improves the look of firmness and elasticity',
      'Supports the collagen network over time',
      'Compatible with retinal in a morning or evening split',
      'Hydrates without heaviness',
    ],
    usage: [
      'Apply 3–4 drops morning and evening.',
      'Can be used in the morning with retinal in the evening.',
    ],
    ingredients:
      'Aqua, Glycerin, Sodium Hyaluronate, Palmitoyl Tripeptide-1, Palmitoyl Tetrapeptide-7, Acetyl Tetrapeptide-5, Copper Tripeptide-1, Biotinoyl Hexapeptide-13, Squalane, Ceramide NP, Panthenol, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.',
    keyIngredients: [
      { ingredientId: 'ing-peptides', note: 'Nine peptides at published working ranges' },
      { ingredientId: 'ing-hyaluronic', note: 'Immediate plumping alongside long-term firming' },
    ],
    gallery: [
      [8100691, 'Elegant glass skincare bottles with labels on a textured fabric'],
      [6167870, 'Minimalist skincare product with an oak leaf on marble'],
      [11741348, 'Elegant skincare bottle on a wooden saucer with dried flowers'],
    ],
    stock: 88,
    isNewArrival: true,
    relatedProductIds: ['prod-retinal-serum', 'prod-night-repair-cream', 'prod-eye-cream'],
    frequentlyBoughtWithIds: ['prod-retinal-serum', 'prod-night-repair-cream'],
    position: 11,
    createdAt: '2026-06-12T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-azelaic-serum',
    slug: 'azelaic-10-ha-serum',
    name: 'Azelaic 10% + HA',
    subtitle: 'Marks, redness and breakouts, at once',
    shortDescription:
      'The rare active that is antibacterial, anti-inflammatory and pigment-targeting without being harsh.',
    description:
      'Very few actives manage four actions at once. Azelaic acid is antibacterial against the organisms associated with acne, anti-inflammatory enough for rosacea-prone skin, keratolytic for texture, and a tyrosinase inhibitor for pigment.\n\nIt is also among the few actives considered appropriate during pregnancy, which makes it the default recommendation for reactive, breakout-prone skin.',
    highlights: [
      '10% azelaic acid — the studied concentration',
      'Antibacterial, keratolytic and pigment-targeting',
      'Suitable for reactive and rosacea-prone skin',
    ],
    price: 58,
    compareAt: 70,
    size: '30 ml',
    categoryId: 'cat-serums',
    productType: 'serum',
    collectionIds: ['col-sensitive-simplified', 'col-vitamin-c-brightening'],
    skinTypeIds: ['st-sensitive', 'st-oily', 'st-combination', 'st-normal'],
    skinConcernIds: ['sc-dark-spots', 'sc-redness', 'sc-breakouts', 'sc-texture'],
    ingredientIds: ['ing-azelaic', 'ing-hyaluronic', 'ing-niacinamide', 'ing-centella'],
    heroIngredientIds: ['ing-azelaic'],
    benefits: [
      'Fades post-inflammatory marks',
      'Calms redness and visible inflammation',
      'Targets breakout-causing bacteria',
      'Safe for use during pregnancy',
    ],
    usage: [
      'Apply 3 drops morning and evening to clean, dry skin.',
      'May be layered under or over niacinamide.',
      'Expect a brief tingle on the first few applications.',
    ],
    ingredients:
      'Aqua, Azelaic Acid, Glycerin, Sodium Hyaluronate, Niacinamide, Centella Asiatica Extract, Dimethyl Isosorbide, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.',
    keyIngredients: [
      { ingredientId: 'ing-azelaic', note: '10%, buffered for daily tolerance' },
      { ingredientId: 'ing-centella', note: 'Cushions the anti-inflammatory action' },
    ],
    gallery: [
      [13573722, 'Close-up of skincare serum bottles with droppers on a pastel surface'],
      [8101532, 'Minimalist skincare product display with natural light and artistic shadows'],
      [7670694, 'Simple minimalist arrangement of cosmetic bottles on a grey background'],
    ],
    badges: [['15% off', 'clay']],
    stock: 142,
    isFeatured: true,
    relatedProductIds: ['prod-niacinamide-serum', 'prod-rice-water-toner', 'prod-vitamin-c-serum'],
    frequentlyBoughtWithIds: ['prod-centella-serum', 'prod-mineral-shield'],
    position: 12,
    createdAt: '2026-03-06T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-centella-serum',
    slug: 'centella-soothing-serum',
    name: 'Centella Soothing Serum',
    subtitle: 'For skin that reacts to everything',
    shortDescription:
      'A fragrance-free centella and panthenol serum for skin that stings at the thought of a new product.',
    description:
      'A long history in traditional medicine, a modern one in dermatology. The madecassoside fraction of centella is particularly well studied for reducing inflammatory signalling and supporting repair.\n\nThis is the shortest ingredient list we make, and it is the formula we suggest to anyone whose skin has stopped tolerating their own routine.',
    highlights: [
      'Nine ingredients, none of them decorative',
      'Fragrance-free, essential-oil-free, alcohol-free',
      'Safe to introduce during a barrier recovery period',
    ],
    price: 54,
    size: '30 ml',
    categoryId: 'cat-serums',
    productType: 'serum',
    collectionIds: ['col-sensitive-simplified', 'col-barrier-ritual'],
    skinTypeIds: ['st-sensitive', 'st-dry', 'st-normal', 'st-combination', 'st-oily'],
    skinConcernIds: ['sc-redness', 'sc-barrier-damage', 'sc-dehydration'],
    ingredientIds: ['ing-centella', 'ing-panthenol', 'ing-madecassoside', 'ing-beta-glucan'],
    heroIngredientIds: ['ing-centella'],
    benefits: [
      'Calms visible redness and reactivity',
      'Safe alongside any active',
      'Supports recovery during retinoid adjustment',
    ],
    usage: [
      'Apply 3 drops morning and evening, or whenever skin feels reactive.',
      'Can be layered immediately over any product.',
    ],
    ingredients:
      'Aqua, Glycerin, Centella Asiatica Extract, Madecassoside, Panthenol, Beta-Glucan, Allantoin, Sodium Hyaluronate, Xanthan Gum, Sodium Benzoate, Potassium Sorbate.',
    keyIngredients: [
      { ingredientId: 'ing-centella', note: 'The anti-inflammatory fraction' },
      { ingredientId: 'ing-panthenol', note: 'Barrier support through the recovery phase' },
    ],
    gallery: [
      [8101534, 'Minimalist still life of a serum bottle with a dropper casting shadows'],
      [6560315, 'Woman applying skincare cream after a shower'],
      [8101673, 'Flat lay of serum bottles and jars on soft fabric with a natural aesthetic'],
    ],
    stock: 176,
    isBestSeller: true,
    relatedProductIds: ['prod-rice-water-toner', 'prod-barrier-serum', 'prod-barrier-cream'],
    frequentlyBoughtWithIds: ['prod-rice-water-toner', 'prod-barrier-cream'],
    position: 13,
    createdAt: '2025-12-04T09:00:00.000Z',
  }),

  /* ---------------- Moisturisers ---------------- */
  makeProduct({
    id: 'prod-barrier-cream',
    slug: 'barrier-cloud-cream',
    name: 'Barrier Cloud Cream',
    subtitle: 'Ceramides and squalane, 48-hour hold',
    shortDescription:
      'A weightless ceramide cream that holds hydration for two days without sitting on the skin.',
    description:
      'Most barrier creams trade comfort for a heavy finish, which is why people stop using them. This is built in three parts: humectants to draw water in, emollients to soften, and a light occlusive to keep both in place.\n\nThe result is a finish light enough to wear sunscreen over.',
    highlights: [
      'A lightweight occlusive-and-humectant barrier cream',
      'Matte finish — wears cleanly under SPF',
      'Fragrance-free, suitable for reactive skin',
    ],
    price: 58,
    compareAt: 68,
    size: '50 ml',
    categoryId: 'cat-moisturisers',
    productType: 'moisturiser',
    collectionIds: ['col-barrier-ritual', 'col-essentials', 'col-dew', 'col-sensitive-simplified'],
    skinTypeIds: ['st-dry', 'st-sensitive', 'st-normal', 'st-combination', 'st-oily'],
    skinConcernIds: ['sc-barrier-damage', 'sc-dehydration', 'sc-redness', 'sc-firmness'],
    ingredientIds: ['ing-ceramides', 'ing-squalane', 'ing-niacinamide', 'ing-panthenol'],
    heroIngredientIds: ['ing-ceramides'],
    benefits: [
      'Holds hydration for 48 hours',
      'Reduces transepidermal water loss',
      'Cushions actives during retinoid use',
      'Comfortable under sunscreen and makeup',
    ],
    usage: [
      'Warm a pea-sized amount between the fingers.',
      'Press into the face and neck as the last step of the evening routine.',
      'In the morning, apply a thinner layer before SPF.',
    ],
    ingredients:
      'Aqua, Glycerin, Caprylic/Capric Triglyceride, Squalane, Cetearyl Alcohol, Glyceryl Stearate, Ceramide NP, Ceramide AP, Niacinamide, Panthenol, Sodium Hyaluronate, Allantoin, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.',
    keyIngredients: [
      { ingredientId: 'ing-ceramides', note: 'The barrier-rebuilding lipid fraction' },
      { ingredientId: 'ing-squalane', note: 'Seals without a waxy finish' },
      { ingredientId: 'ing-niacinamide', note: 'Supports the barrier it sits on' },
    ],
    variants: [
      { name: 'Standard', size: '50 ml', price: 58, compareAt: 68, stock: 268 },
      { name: 'Travel', size: '20 ml', price: 28, stock: 310 },
    ],
    gallery: [
      [13794471, 'Open jar of calming moisture barrier cream on marble'],
      [10221858, 'Detailed shot of hands opening a face cream jar'],
      [7691098, 'Elegant white skincare products arranged on a light background'],
    ],
    badges: [['Featured', 'moss'], ['15% off', 'clay']],
    stock: 268,
    isBestSeller: true,
    isFeatured: true,
    relatedProductIds: ['prod-barrier-serum', 'prod-hydrating-essence', 'prod-centella-serum'],
    frequentlyBoughtWithIds: ['prod-barrier-serum', 'prod-hydrating-essence'],
    position: 14,
    createdAt: '2025-11-14T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-night-repair-cream',
    slug: 'night-repair-cream',
    name: 'Night Repair Cream',
    subtitle: 'Retinol 0.3%, slow-release',
    shortDescription:
      'An encapsulated retinol cream that releases overnight at a steady rate, without the sting.',
    description:
      'The reason most people abandon retinol cream is the first fortnight of irritation. Encapsulating the retinol in a lipid shell slows its release through the night, which means less peak concentration at the skin surface.\n\nThe result is a formula that delivers 0.3% retinol with a much gentler start, and a cream rich enough to buffer it. Best used two or three nights a week, building as tolerated.',
    highlights: [
      '0.3% retinol in lipid-encapsulated form',
      'Designed to be tolerable from night one',
      'Buffered with squalane and ceramides',
    ],
    price: 94,
    size: '50 ml',
    categoryId: 'cat-moisturisers',
    productType: 'moisturiser',
    collectionIds: ['col-retinal-repair', 'col-barrier-ritual'],
    skinTypeIds: ['st-dry', 'st-normal', 'st-combination'],
    skinConcernIds: ['sc-fine-lines', 'sc-texture', 'sc-firmness'],
    ingredientIds: ['ing-retinol', 'ing-squalane', 'ing-ceramides', 'ing-peptides', 'ing-oat'],
    heroIngredientIds: ['ing-retinol'],
    benefits: [
      'Softens the appearance of fine lines overnight',
      'Gentler introduction than a conventional retinol cream',
      'Leaves skin comfortable rather than tight',
    ],
    usage: [
      'Apply generously to clean, dry skin as the final evening step.',
      'Begin two or three nights a week and build to nightly.',
      'Sunscreen the following morning is not optional.',
    ],
    ingredients:
      'Aqua, Glycerin, Caprylic/Capric Triglyceride, Squalane, Cetearyl Alcohol, Retinol, Ceramide NP, Niacinamide, Palmitoyl Tripeptide-1, Avena Sativa Kernel Extract, Tocopherol, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.',
    keyIngredients: [
      { ingredientId: 'ing-retinol', note: '0.3%, lipid-encapsulated for a slower release' },
      { ingredientId: 'ing-ceramides', note: 'Buffers the retinoid at the skin surface' },
      { ingredientId: 'ing-oat', note: 'Cuts the itch commonly associated with retinoids' },
    ],
    warnings: [
      'Not suitable during pregnancy or breastfeeding.',
      'Do not layer in the same routine as direct acids or retinal.',
    ],
    gallery: [
      [4173450, 'Minimalist product image of a bamboo-lidded skincare jar'],
      [3785147, 'Luxury skincare products arranged on a warm soft surface'],
      [7691161, 'Elegant close-up of white cosmetic containers in a minimalist setting'],
    ],
    stock: 92,
    isNewArrival: true,
    relatedProductIds: ['prod-retinal-serum', 'prod-peptide-serum', 'prod-lipid-recovery-oil'],
    frequentlyBoughtWithIds: ['prod-retinal-serum', 'prod-barrier-cream'],
    position: 15,
    createdAt: '2026-04-22T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-weightless-lotion',
    slug: 'weightless-hydration-lotion',
    name: 'Weightless Hydration Lotion',
    subtitle: 'For oily and combination skin',
    shortDescription:
      'A gel-lotion that hydrates properly without leaving a film or sliding off under sunscreen.',
    description:
      'Oily skin is frequently dehydrated, and most moisturisers aimed at it are either too light to do anything or too heavy to wear. This is a gel-lotion: 70% water, held together with a light gel network, and finished with a small amount of dimethicone for slip.\n\nIt absorbs in under a minute and does not pill under sunscreen or makeup.',
    highlights: [
      '70% water gel-lotion base',
      'Absorbs in under a minute, no pilling',
      'Non-comedogenic, fragrance-free',
    ],
    price: 46,
    size: '120 ml',
    categoryId: 'cat-moisturisers',
    productType: 'moisturiser',
    collectionIds: ['col-dew', 'col-essentials'],
    skinTypeIds: ['st-oily', 'st-combination', 'st-normal'],
    skinConcernIds: ['sc-dehydration', 'sc-congestion', 'sc-dullness'],
    ingredientIds: ['ing-niacinamide', 'ing-hyaluronic', 'ing-panthenol', 'ing-green-tea'],
    heroIngredientIds: ['ing-hyaluronic'],
    benefits: [
      'Hydrates without adding shine',
      'Sits cleanly under sunscreen and makeup',
      'Non-comedogenic for congestion-prone skin',
    ],
    usage: [
      'Apply a small amount morning and evening.',
      'In the morning, follow immediately with SPF.',
    ],
    ingredients:
      'Aqua, Glycerin, Dimethicone, Sodium Hyaluronate, Niacinamide, Panthenol, Camellia Sinensis Leaf Extract, Cetearyl Alcohol, Glyceryl Stearate Citrate, Allantoin, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.',
    keyIngredients: [
      { ingredientId: 'ing-niacinamide', note: 'Keeps sebum regulated alongside hydration' },
      { ingredientId: 'ing-hyaluronic', note: 'Multi-weight hydration in a light base' },
    ],
    gallery: [
      [7691162, 'Elegant display of skincare products in a minimalist natural setting'],
      [6621461, 'Overhead view of cosmetic bottles on a white marble table with salt'],
      [8102129, 'Skincare products with serums, a gua sha tool and bar soap on dark fabric'],
    ],
    stock: 208,
    isNewArrival: true,
    relatedProductIds: ['prod-niacinamide-serum', 'prod-clarifying-gel-cleanser', 'prod-hydrating-essence'],
    frequentlyBoughtWithIds: ['prod-niacinamide-serum', 'prod-invisible-fluid-spf'],
    position: 16,
    createdAt: '2026-05-14T09:00:00.000Z',
  }),

  /* ---------------- Eye ---------------- */
  makeProduct({
    id: 'prod-eye-cream',
    slug: 'sculpting-eye-cream',
    name: 'Sculpting Eye Cream',
    subtitle: '8% caffeine, peptides, colloidal oat',
    shortDescription:
      'A light eye cream for puffiness, dark circles and the fine lines that appear first.',
    description:
      'The orbital skin is thinner, creases constantly and drains differently from the rest of the face, which is why it shows age first and responds to caffeine in a way the cheeks do not.\n\nThis is a gel-cream with 8% caffeine, a peptide complex and colloidal oat. It is deliberately light: the skin there tolerates rich products badly, and puffy mornings are usually worsened by them.',
    highlights: [
      '8% caffeine for visible morning puffiness',
      'Peptide complex for the appearance of crepe lines',
      'Light gel-cream — no concealer drag',
    ],
    price: 62,
    size: '15 ml',
    categoryId: 'cat-eye',
    productType: 'eye',
    collectionIds: ['col-essentials', 'col-retinal-repair'],
    skinTypeIds: ['st-normal', 'st-dry', 'st-combination', 'st-sensitive'],
    skinConcernIds: ['sc-fine-lines', 'sc-dehydration', 'sc-dullness'],
    ingredientIds: ['ing-caffeine', 'ing-peptides', 'ing-oat', 'ing-hyaluronic'],
    heroIngredientIds: ['ing-peptides'],
    benefits: [
      'Reduces the appearance of morning puffiness',
      'Softens the look of fine crepe lines',
      'Smooths the texture of concealer application',
      'Hydrates a delicate area without heaviness',
    ],
    usage: [
      'Tap a rice-grain amount along the orbital bone with the ring finger.',
      'Use morning and evening, working outward from the inner corner.',
      'Do not apply to the lash line or the eye itself.',
    ],
    ingredients:
      'Aqua, Glycerin, Caffeine, Niacinamide, Sodium Hyaluronate, Palmitoyl Tripeptide-1, Acetyl Hexapeptide-8, Avena Sativa Kernel Extract, Squalane, Cetearyl Alcohol, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.',
    keyIngredients: [
      { ingredientId: 'ing-peptides', note: 'Targeted at the appearance of crepe lines' },
      { ingredientId: 'ing-oat', note: 'Soothes the thin, reactive skin here' },
    ],
    gallery: [
      [6925480, 'Jar of face cream on a clean surface'],
      [6560315, 'Woman applying skincare cream after a shower'],
      [7691098, 'Elegant white skincare products arranged on a light background'],
    ],
    stock: 118,
    relatedProductIds: ['prod-peptide-serum', 'prod-retinal-serum', 'prod-lipid-recovery-oil'],
    frequentlyBoughtWithIds: ['prod-retinal-serum', 'prod-peptide-serum'],
    position: 17,
    createdAt: '2025-12-12T09:00:00.000Z',
  }),

  /* ---------------- Masks & treatments ---------------- */
  makeProduct({
    id: 'prod-mineral-clay-mask',
    slug: 'mineral-clay-mask',
    name: 'Mineral Clay Mask',
    subtitle: 'Kaolin and bentonite, 10 minutes',
    shortDescription:
      'A two-clay mask that draws out congestion without leaving skin tight or stripped.',
    description:
      'Kaolin is gentle and cosmetic; bentonite is strong and drawing. Used alone, either can leave skin tight. Together in this ratio, they lift what the acid loosens without removing the lipids that keep the surface comfortable.\n\nTen minutes, once or twice a week. Do not let it dry to cracking.',
    highlights: [
      'Kaolin and bentonite in a balanced ratio',
      'Non-drying — will not crack or tighten',
      'Can be used as a spot treatment overnight',
    ],
    price: 42,
    size: '75 ml',
    categoryId: 'cat-treatments',
    productType: 'mask',
    collectionIds: ['col-essentials'],
    skinTypeIds: ['st-oily', 'st-combination', 'st-normal'],
    skinConcernIds: ['sc-congestion', 'sc-breakouts', 'sc-texture'],
    ingredientIds: ['ing-kaolin', 'ing-bentonite', 'ing-green-tea', 'ing-niacinamide'],
    heroIngredientIds: ['ing-niacinamide'],
    benefits: [
      'Draws congestion from the pore',
      'Absorbs excess oil without stripping',
      'Refines the appearance of pores',
    ],
    usage: [
      'Apply a thin, even layer to clean, dry skin.',
      'Leave 10 minutes. Do not allow to dry completely.',
      'Rinse with lukewarm water and follow with a hydrating serum.',
    ],
    ingredients:
      'Kaolin, Bentonite, Aqua, Glycerin, Camellia Sinensis Leaf Extract, Niacinamide, Allantoin, Zinc Oxide, Xanthan Gum, Citric Acid, Sodium Benzoate, Potassium Sorbate.',
    keyIngredients: [
      { ingredientId: 'ing-green-tea', note: 'Antioxidant working alongside the clays' },
      { ingredientId: 'ing-niacinamide', note: 'Keeps sebum regulated between treatments' },
    ],
    gallery: [
      [11124449, 'Flat lay display of skincare oils and creams on pastel backgrounds'],
      [8102021, 'Flat lay of serum bottles and a gua sha tool on dark textile'],
      [6476122, 'Overhead view of skincare products and tools on a neutral background'],
    ],
    stock: 148,
    relatedProductIds: ['prod-clarifying-gel-cleanser', 'prod-niacinamide-serum', 'prod-weightless-lotion'],
    frequentlyBoughtWithIds: ['prod-clarifying-gel-cleanser', 'prod-niacinamide-serum'],
    position: 18,
    createdAt: '2025-12-20T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-renewal-mask',
    slug: 'overnight-renewal-mask',
    name: 'Overnight Renewal Mask',
    subtitle: 'Peptide, squalane and oat, overnight',
    shortDescription:
      'A breathable sleeping mask that works while you do, and rinses off clean in the morning.',
    description:
      'Most overnight masks are heavy occlusives that trap bacteria and pill under tomorrow’s SPF. This one is built differently: a light gel base with a squalane-rich lipid layer and a peptide and colloidal oat complex.\n\nIt absorbs in about two minutes, does not transfer onto a pillowcase, and rinses off completely in the morning with water alone.',
    highlights: [
      'Absorbs in two minutes — transfers to nothing',
      'Squalane and colloidal oat, never heavy',
      'Rinses off with water alone',
    ],
    price: 54,
    size: '80 ml',
    categoryId: 'cat-treatments',
    productType: 'mask',
    collectionIds: ['col-barrier-ritual', 'col-sensitive-simplified', 'col-dew'],
    skinTypeIds: ['st-dry', 'st-sensitive', 'st-normal', 'st-combination'],
    skinConcernIds: ['sc-barrier-damage', 'sc-dehydration', 'sc-firmness', 'sc-redness'],
    ingredientIds: ['ing-squalane', 'ing-peptides', 'ing-oat', 'ing-hyaluronic'],
    heroIngredientIds: ['ing-squalane'],
    benefits: [
      'Intensive overnight hydration',
      'Supports overnight barrier recovery',
      'Leaves no residue in the morning',
    ],
    usage: [
      'Apply a thin layer as the final step of the evening routine.',
      'Wake and rinse with lukewarm water. No cleanser needed.',
      'Use two or three nights a week.',
    ],
    ingredients:
      'Aqua, Glycerin, Squalane, Sodium Hyaluronate, Palmitoyl Tripeptide-1, Avena Sativa Kernel Extract, Panthenol, Beta-Glucan, Allantoin, Cetearyl Alcohol, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.',
    keyIngredients: [
      { ingredientId: 'ing-oat', note: 'Cools and calms overnight' },
      { ingredientId: 'ing-peptides', note: 'Works during the skin’s repair window' },
    ],
    gallery: [
      [10221858, 'Detailed shot of hands opening a face cream jar'],
      [7691112, 'Minimalist arrangement of white skincare products and towels'],
      [10574048, 'Collection of skincare products arranged in a bathroom setting'],
    ],
    stock: 104,
    isNewArrival: true,
    relatedProductIds: ['prod-barrier-cream', 'prod-barrier-serum', 'prod-lipid-recovery-oil'],
    frequentlyBoughtWithIds: ['prod-barrier-cream', 'prod-lipid-recovery-oil'],
    position: 19,
    createdAt: '2026-06-28T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-resurfacing-pads',
    slug: 'resurfacing-pads',
    name: 'Resurfacing Pads',
    subtitle: '8% lactic and BHA, pre-saturated',
    shortDescription:
      'Pre-saturated exfoliating pads for a controlled, even dose — no decanting, no guesswork.',
    description:
      'Liquid exfoliants require cotton pads, and the dose depends entirely on how thoroughly the pad is soaked. These arrive pre-saturated at a controlled 8% lactic and salicylic blend.\n\nUse at night, two or three times a week. The pad is single-use, and the bottle refill is sold separately so the packaging is not thrown away every month.',
    highlights: [
      'Pre-saturated at a controlled 8% blend',
      'Single-use, no decanting step',
      'Refill bottle available separately',
    ],
    price: 38,
    size: '60 pads',
    categoryId: 'cat-treatments',
    productType: 'mask',
    collectionIds: ['col-vitamin-c-brightening'],
    skinTypeIds: ['st-normal', 'st-combination', 'st-oily'],
    skinConcernIds: ['sc-texture', 'sc-dullness', 'sc-dark-spots'],
    ingredientIds: ['ing-lactic-acid', 'ing-salicylic-acid', 'ing-green-tea', 'ing-panthenol'],
    heroIngredientIds: ['ing-lactic-acid'],
    benefits: [
      'Evens texture and tone',
      'Clears congestion inside the pore',
      'Removes dull surface build-up',
    ],
    usage: [
      'Take one pad and sweep over clean, dry skin at night, avoiding the eye area.',
      'Do not layer with retinal or vitamin C in the same routine.',
      'Follow with a hydrating serum and a richer cream.',
    ],
    ingredients:
      'Aqua, Lactic Acid, Salicylic Acid, Glycerin, Panthenol, Camellia Sinensis Leaf Extract, Allantoin, Sodium Hyaluronate, Hydroxyethylcellulose, Sodium Benzoate, Potassium Sorbate.',
    keyIngredients: [
      { ingredientId: 'ing-lactic-acid', note: 'AHA for surface exfoliation' },
      { ingredientId: 'ing-green-tea', note: 'Cushions the acid against irritation' },
    ],
    warnings: [
      'Do not use during pregnancy without medical advice.',
      'Not suitable on the same night as retinal or the Night Repair Cream.',
    ],
    variants: [
      { name: 'Standard', size: '60 pads', price: 38, stock: 196 },
      { name: 'Refill', size: '60 pads', price: 26, stock: 240 },
    ],
    gallery: [
      [6476122, 'Overhead view of skincare products and tools on a neutral background'],
      [8102129, 'Skincare products with serums, a gua sha tool and bar soap on dark fabric'],
      [7670680, 'Elegant minimalist shot of skincare product containers on a grey background'],
    ],
    stock: 196,
    relatedProductIds: ['prod-vitamin-c-serum', 'prod-azelaic-serum', 'prod-barrier-cream'],
    frequentlyBoughtWithIds: ['prod-barrier-cream', 'prod-hydrating-essence'],
    position: 20,
    createdAt: '2026-01-26T09:00:00.000Z',
  }),

  /* ---------------- Oils ---------------- */
  makeProduct({
    id: 'prod-midnight-oil',
    slug: 'midnight-face-oil',
    name: 'Midnight Face Oil',
    subtitle: 'Squalane and eight cold-pressed oils',
    shortDescription:
      'A dry-touch finishing oil that seals in hydration without sitting on the skin.',
    description:
      'Single-plant oils oxidise, which is why older formulas smell of crayons after a few months. This blend is built around squalcane, which is saturated and therefore stable, with eight cold-pressed oils for their fatty-acid profiles.\n\nTwo drops is enough. Press over a moisturiser at night, or add one drop to a cream in winter.',
    highlights: [
      'Squalane base — will not oxidise or go rancid',
      'Eight cold-pressed oils for fatty-acid balance',
      'Dry-touch finish, absorbs in about a minute',
    ],
    price: 84,
    size: '30 ml',
    categoryId: 'cat-oils',
    productType: 'oil',
    collectionIds: ['col-barrier-ritual', 'col-dew', 'col-sensitive-simplified'],
    skinTypeIds: ['st-dry', 'st-normal', 'st-sensitive', 'st-combination'],
    skinConcernIds: ['sc-barrier-damage', 'sc-dehydration', 'sc-firmness'],
    ingredientIds: ['ing-squalane', 'ing-rosehip', 'ing-marula', 'ing-evening-primrose', 'ing-squalene-olive'],
    heroIngredientIds: ['ing-squalane'],
    benefits: [
      'Seals hydration in overnight',
      'Softens rough, flaking texture',
      'Protects the barrier in cold weather',
      'Improves the feel of a cream without changing it',
    ],
    usage: [
      'Warm two to three drops between the palms.',
      'Press over the face and neck as the final step at night.',
      'Add one drop to your moisturiser in very dry conditions.',
    ],
    ingredients:
      'Squalane, Rosa Canina (Rosehip) Seed Oil, Sclerocarya Birrea (Marula) Seed Oil, Oenothera Biennis (Evening Primrose) Oil, Simmondsia Chinensis (Jojoba) Seed Oil, Limnanthes Alba (Meadowfoam) Seed Oil, Helianthus Annuus Seed Oil, Tocopherol, Rosmarinus Officinalis Leaf Extract.',
    keyIngredients: [
      { ingredientId: 'ing-squalane', note: 'The stable base the blend is built on' },
      { ingredientId: 'ing-rosehip', note: 'Linoleic acid and trace retinoid activity' },
    ],
    gallery: [
      [8490182, 'Glass bottle of golden oil surrounded by green leaves on fabric'],
      [6438788, 'Facial oil bottle on a wooden table in a natural setting'],
      [10695206, 'Facial oil product shot with natural styling'],
    ],
    stock: 86,
    isFeatured: true,
    relatedProductIds: ['prod-barrier-cream', 'prod-renewal-mask', 'prod-lipid-recovery-oil'],
    frequentlyBoughtWithIds: ['prod-renewal-mask', 'prod-barrier-cream'],
    position: 21,
    createdAt: '2025-11-30T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-lipid-recovery-oil',
    slug: 'lipid-recovery-oil',
    name: 'Lipid Recovery Oil',
    subtitle: 'Cholesterol and ceramide lipids',
    shortDescription:
      'A lipid-first oil for skin that cannot tolerate water-based formulas at all.',
    description:
      'Some skin — eczema-prone, extremely dry, or simply weather-beaten — reacts to water-based products with stinging and redness. This is a pure anhydrous oil containing the barrier lipids themselves, so nothing needs to be emulsified or absorbed from a water phase.\n\nUse it as the first and only product during a severe flare, and as the final step otherwise.',
    highlights: [
      'Anhydrous — no water phase at all',
      'Cholesterol and ceramide lipids, not just plant oils',
      'Safe during a barrier flare',
    ],
    price: 92,
    size: '30 ml',
    categoryId: 'cat-oils',
    productType: 'oil',
    collectionIds: ['col-barrier-ritual', 'col-sensitive-simplified'],
    skinTypeIds: ['st-dry', 'st-sensitive'],
    skinConcernIds: ['sc-barrier-damage', 'sc-redness', 'sc-dehydration'],
    ingredientIds: ['ing-squalane', 'ing-ceramides', 'ing-cholesterol', 'ing-sunflower-seed-oil'],
    heroIngredientIds: ['ing-ceramides'],
    benefits: [
      'Suitable during a severe barrier flare',
      'Rebuilds the lipid matrix directly',
      'Never stings, whatever the state of the skin',
    ],
    usage: [
      'Apply three to four drops to clean skin, morning and evening.',
      'During a flare, use as the only product for several days.',
      'Once settled, layer a hydrating serum underneath.',
    ],
    ingredients:
      'Squalane, Helianthus Annuus (Sunflower) Seed Oil, Ceramide NP, Ceramide AP, Cholesterol, Phytosphingosine, Linoleic Acid, Tocopherol.',
    keyIngredients: [
      { ingredientId: 'ing-ceramides', note: 'The barrier lipid itself, in an anhydrous base' },
      { ingredientId: 'ing-squalane', note: 'A stable carrier that will not oxidise' },
    ],
    gallery: [
      [10695206, 'Elegant facial oil product shot with a natural aesthetic'],
      [8490173, 'Skincare oil bottle with geometric stones on textured fabric'],
      [6724313, 'Calming spa setup with aromatherapy candle and essential oils'],
    ],
    stock: 42,
    lowStockThreshold: 10,
    relatedProductIds: ['prod-rich-cream-cleanser', 'prod-barrier-serum', 'prod-renewal-mask'],
    frequentlyBoughtWithIds: ['prod-barrier-serum', 'prod-rich-cream-cleanser'],
    position: 22,
    createdAt: '2026-02-18T09:00:00.000Z',
  }),

  /* ---------------- Sun care ---------------- */
  makeProduct({
    id: 'prod-mineral-shield',
    slug: 'mineral-shield-spf-50',
    name: 'Mineral Shield SPF 50',
    subtitle: 'Non-nano zinc, no white cast',
    shortDescription:
      'A 21% non-nano zinc sunscreen that disappears on every skin tone and layers under makeup.',
    description:
      'Zinc oxide is the only single filter covering the entire UVB and UVA range, and it is anti-inflammatory, which matters enormously for reactive skin.\n\nThe difficulty has always been the cast. This uses non-nano particles dispersed in a silica base with iron oxides, which neutralise the cast across all skin tones without leaving a grey veil.\n\nIt is the one product we would still recommend if a client could only keep one.',
    highlights: [
      '21% non-nano zinc oxide — broadest filter available',
      'Iron oxides neutralise the cast on all skin tones',
      'Anti-inflammatory, suitable for reactive skin',
    ],
    price: 48,
    size: '50 ml',
    categoryId: 'cat-sun-care',
    productType: 'sunscreen',
    collectionIds: ['col-essentials', 'col-vitamin-c-brightening', 'col-sensitive-simplified'],
    skinTypeIds: ['st-sensitive', 'st-dry', 'st-normal', 'st-combination', 'st-oily'],
    skinConcernIds: ['sc-dark-spots', 'sc-fine-lines', 'sc-redness', 'sc-dullness'],
    ingredientIds: ['ing-zinc', 'ing-titanium-dioxide', 'ing-green-tea', 'ing-panthenol'],
    heroIngredientIds: ['ing-zinc'],
    benefits: [
      'Broadest possible UVA and UVB protection',
      'No white cast on any skin tone',
      'Suitable for reactive and rosacea-prone skin',
      'Does not sting the eyes',
    ],
    usage: [
      'Apply two finger-lengths to the face and neck as the final morning step.',
      'Reapply every two hours of direct sun exposure.',
      'Use as the last step of the morning routine, over moisturiser.',
    ],
    ingredients:
      'Aqua, Zinc Oxide, Caprylic/Capric Triglyceride, Glycerin, Silica, Iron Oxides, Coco-Caprylate, Polymethylsilsequinoxane, Camellia Sinensis Leaf Extract, Panthenol, Tocopherol, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.',
    keyIngredients: [
      { ingredientId: 'ing-zinc', note: '21% non-nano zinc oxide, the broadest single filter' },
      { ingredientId: 'ing-green-tea', note: 'Antioxidant working beneath the filter' },
    ],
    variants: [
      { name: 'Standard', size: '50 ml', price: 48, stock: 384 },
      { name: 'Large', size: '100 ml', price: 78, stock: 120 },
    ],
    gallery: [
      [13779260, 'Vertical shot of UV protection cream with SPF 50 in studio lighting'],
      [13779259, 'Elegant sunscreen tube with soft shadows and dried flowers'],
      [13779258, 'Minimalist flat lay of mineral sunscreen with natural elements'],
    ],
    badges: [['Featured', 'moss'], ['SPF 50', 'ink']],
    stock: 384,
    isBestSeller: true,
    isFeatured: true,
    relatedProductIds: ['prod-vitamin-c-serum', 'prod-weightless-lotion', 'prod-softening-milk-cleanser'],
    frequentlyBoughtWithIds: ['prod-vitamin-c-serum', 'prod-hydrating-essence'],
    position: 23,
    createdAt: '2025-11-14T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-invisible-fluid-spf',
    slug: 'invisible-fluid-spf-50',
    name: 'Invisible Fluid SPF 50+',
    subtitle: 'Hybrid filters, cosmetically elegant',
    shortDescription:
      'A modern hybrid sunscreen with a skin-like finish that wears invisibly under makeup and SPF.',
    description:
      'Pure mineral sunscreens are safe but rarely elegant, and most people abandon them within a month. This is a hybrid: modern organic filters for a cosmetically excellent finish, with 4% non-nano zinc for the UV spectrum the organics miss.\n\nIt applies like a serum, sits invisibly under makeup, and does not pill when reapplied over makeup — which is the difference between a sunscreen that gets used and one that sits in a bathroom.',
    highlights: [
      'Hybrid filter system with 4% non-nano zinc',
      'No pilling when reapplied over makeup',
      'Invisible on every skin tone',
    ],
    price: 44,
    size: '50 ml',
    categoryId: 'cat-sun-care',
    productType: 'sunscreen',
    collectionIds: ['col-essentials'],
    skinTypeIds: ['st-normal', 'st-combination', 'st-oily', 'st-dry'],
    skinConcernIds: ['sc-dark-spots', 'sc-dullness', 'sc-fine-lines'],
    ingredientIds: ['ing-zinc', 'ing-vitamin-e', 'ing-niacinamide', 'ing-green-tea'],
    heroIngredientIds: ['ing-zinc'],
    benefits: [
      'Wears invisibly under makeup',
      'Can be reapplied over makeup without pilling',
      'Broad spectrum with no grey cast',
    ],
    usage: [
      'Shake well and apply generously as the final morning step.',
      'Reapply every two hours in direct sun.',
      'Reapply over makeup with a powder or cream formula.',
    ],
    ingredients:
      'Aqua, Homosalate, Ethylhexyl Salicylate, Butyl Methoxydibenzoylmethane, Octocrylene, Glycerin, Zinc Oxide, Silica, Niacinamide, Camellia Sinensis Leaf Extract, Tocopherol, Sodium Citrate, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.',
    keyIngredients: [
      { ingredientId: 'ing-zinc', note: '4% non-nano zinc completing the spectrum' },
      { ingredientId: 'ing-vitamin-e', note: 'Antioxidant that also stabilises the filters' },
    ],
    gallery: [
      [13779258, 'Minimalist flat lay of mineral sunscreen with natural elements'],
      [13779256, 'Close-up of SPF protection cream with floral accents'],
      [7670694, 'Simple minimalist arrangement of cosmetic bottles on a grey background'],
    ],
    stock: 298,
    isBestSeller: true,
    relatedProductIds: ['prod-weightless-lotion', 'prod-niacinamide-serum', 'prod-vitamin-c-serum'],
    frequentlyBoughtWithIds: ['prod-weightless-lotion', 'prod-niacinamide-serum'],
    position: 24,
    createdAt: '2025-12-16T09:00:00.000Z',
  }),

  /* ---------------- Tools ---------------- */
  makeProduct({
    id: 'prod-jade-gua-sha',
    slug: 'jade-gua-sha',
    name: 'Jade Gua Sha',
    subtitle: 'Xiaojiatan jade, hand-cut',
    shortDescription:
      'A hand-cut gua sha stone that genuinely decongests — and a satin pouch to keep it in.',
    description:
      'Most gua sha on the market are resin or low-grade stone. This is Xiaojiatan jade, selected for hardness and for the way it holds a cool temperature against the skin.\n\nUse it along the jaw, cheekbones and the two channels beside the nose. Warm it slightly in the hands first, always use oil or serum as a glide, and never drag over the eye.',
    highlights: [
      'Genuine Xiaojiatan jade, not resin',
      'Includes a cotton pouch and a linen cloth',
      'Holds a cool temperature against the skin',
    ],
    price: 58,
    size: 'One size',
    categoryId: 'cat-tools',
    productType: 'tool',
    collectionIds: ['col-dew', 'col-essentials'],
    skinTypeIds: ['st-normal', 'st-combination', 'st-dry', 'st-oily', 'st-sensitive'],
    skinConcernIds: ['sc-congestion', 'sc-firmness', 'sc-dullness'],
    ingredientIds: [],
    benefits: [
      'Reduces the appearance of puffiness',
      'Sculpts along the jaw and cheekbones',
      'Improves the absorption of oil-based serums',
    ],
    usage: [
      'Apply a generous layer of oil or a hydrating serum to the face.',
      'Hold the stone at 90° to the skin and press — never drag hard.',
      'Sweep outward along the jaw and cheekbones, five to seven strokes each side.',
      'Clean with warm water and a soft cloth after use.',
    ],
    ingredients: '',
    keyIngredients: [],
    gallery: [
      [8102129, 'Skincare products with serums, a gua sha tool and bar soap on dark fabric'],
      [8102021, 'Flat lay of serum bottles and a gua sha tool on dark textile'],
      [7691098, 'Elegant white skincare products arranged on a light background'],
    ],
    stock: 68,
    relatedProductIds: ['prod-midnight-oil', 'prod-hydrating-essence', 'prod-mineral-clay-mask'],
    frequentlyBoughtWithIds: ['prod-midnight-oil', 'prod-hydrating-essence'],
    position: 25,
    createdAt: '2025-12-06T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-cleansing-brush',
    slug: 'cleansing-brush',
    name: 'Cleansing Brush',
    subtitle: 'Plant fibre, no compromise',
    shortDescription:
      'A soft plant-fibre brush that lifts SPF and light makeup without the abrasion of a scrub.',
    description:
      'A brush is a tool for suspension, not for scrubbing. This one has extremely fine plant-fibre bristles, soft enough for reactive skin, that emulsify oil-based formulas before they are rinsed.\n\nUsed with the Cleansing Balm it removes a full day of sunscreen in a single cleanse without any mechanical friction.',
    highlights: [
      'Ultra-fine plant fibre, soft on reactive skin',
      'Handle is seamless and easy to sanitise',
      'Designed for use with an oil cleanser',
    ],
    price: 34,
    size: 'One size',
    categoryId: 'cat-tools',
    productType: 'tool',
    collectionIds: ['col-essentials'],
    skinTypeIds: ['st-normal', 'st-combination', 'st-oily', 'st-dry'],
    skinConcernIds: ['sc-congestion', 'sc-dullness'],
    ingredientIds: [],
    benefits: [
      'Lifts sunscreen and light makeup efficiently',
      'Adds no mechanical abrasion',
      'Improves the emulsification of oil cleansers',
    ],
    usage: [
      'Use with an oil or balm cleanser on damp skin.',
      'Circle gently for 30 seconds, without pressure.',
      'Rinse the brush thoroughly and air-dry bristles-down.',
    ],
    ingredients: '',
    keyIngredients: [],
    gallery: [
      [9335961, 'Facial massage and cleansing in progress'],
      [6568231, 'Close-up of clear, healthy skin'],
      [7691164, 'Clean display of skincare products on a white surface with a towel backdrop'],
    ],
    stock: 124,
    relatedProductIds: ['prod-cleansing-balm', 'prod-softening-milk-cleanser', 'prod-invisible-fluid-spf'],
    frequentlyBoughtWithIds: ['prod-cleansing-balm', 'prod-softening-milk-cleanser'],
    position: 26,
    createdAt: '2026-01-12T09:00:00.000Z',
  }),

  /* ---------------- Sets ---------------- */
  makeProduct({
    id: 'prod-barrier-discovery-set',
    slug: 'barrier-discovery-set',
    name: 'The Barrier Discovery Set',
    subtitle: 'Ten days, four steps, full size',
    shortDescription:
      'The complete Barrier Ritual at travel size — ten genuine days to find out whether it works for you.',
    description:
      'Skincare is variable and reading cannot replace wearing. This is the full Barrier Ritual in 15 ml and 20 ml sizes, at the same concentrations as the full-size products.\n\nTen days is enough to know whether your skin tolerates the routine, which is the question people actually need answered before committing to four full-size products.',
    highlights: [
      'Four full steps at true concentrations',
      'Ten days of use — enough to assess tolerance',
      'Presented in a reusable glass tray',
    ],
    price: 68,
    compareAt: 96,
    size: '4-piece set',
    categoryId: 'cat-sets',
    productType: 'serum',
    collectionIds: ['col-barrier-ritual', 'col-discovery-sets'],
    skinTypeIds: ['st-dry', 'st-sensitive', 'st-normal', 'st-combination'],
    skinConcernIds: ['sc-barrier-damage', 'sc-dehydration', 'sc-redness'],
    ingredientIds: ['ing-ceramides', 'ing-centella', 'ing-niacinamide', 'ing-panthenol'],
    heroIngredientIds: ['ing-ceramides'],
    benefits: [
      'Test the full barrier routine before committing',
      'Identical concentrations to the full-size products',
      'A complete four-step routine in one box',
    ],
    usage: [
      'Morning: cleanse, essence, SPF.',
      'Evening: cleanse, serum, cream, and oil if skin is very dry.',
      'Judge tolerance after ten days, not after two.',
    ],
    ingredients:
      'See the individual product pages for full ingredient lists. All formulas are fragrance-free and pH 5.5 or above.',
    keyIngredients: [
      { ingredientId: 'ing-ceramides', note: 'The lipid core of the ritual' },
      { ingredientId: 'ing-centella', note: 'Calms during the recovery period' },
    ],
    gallery: [
      [3785147, 'Luxury skincare products arranged on a warm soft surface'],
      [4202325, 'Assorted cosmetic bottles on a marble shelf against a beige wall'],
      [7691112, 'Minimalist arrangement of white skincare products and towels'],
    ],
    badges: [['Save 29%', 'clay']],
    stock: 132,
    relatedProductIds: ['prod-barrier-serum', 'prod-barrier-cream', 'prod-softening-milk-cleanser'],
    frequentlyBoughtWithIds: ['prod-mineral-shield'],
    position: 27,
    createdAt: '2026-03-18T09:00:00.000Z',
  }),
  makeProduct({
    id: 'prod-travel-set',
    slug: 'travel-essentials-set',
    name: 'Travel Essentials Set',
    subtitle: 'Seven days, cabin-legal, no decant risk',
    shortDescription:
      'A complete routine in 50 ml sizes that fits in the hand luggage allowance for any airline.',
    description:
      'Decanting is where travel routines go wrong — the dropper never seals, the label falls off, and the formula oxidises in the heat of a car.\n\nThese are factory-sealed 50 ml sizes of four products, all within the 100 ml cabin allowance. The box fits in a handbag and the routine is identical to the one you use at home.',
    highlights: [
      'Factory-sealed 50 ml sizes, no decanting',
      'Within the 100 ml cabin limit for all airlines',
      'A complete four-step routine',
    ],
    price: 74,
    compareAt: 104,
    size: '4-piece set',
    categoryId: 'cat-sets',
    productType: 'serum',
    collectionIds: ['col-essentials', 'col-discovery-sets'],
    skinTypeIds: ['st-normal', 'st-combination', 'st-oily', 'st-dry', 'st-sensitive'],
    skinConcernIds: ['sc-dehydration', 'sc-dullness', 'sc-congestion'],
    ingredientIds: ['ing-niacinamide', 'ing-hyaluronic', 'ing-zinc', 'ing-panthenol'],
    heroIngredientIds: ['ing-niacinamide'],
    benefits: [
      'The complete routine, travel-sized and sealed',
      'No decanting, no leakage, no oxidation',
      'Fits within every airline’s cabin allowance',
    ],
    usage: [
      'Morning: cleanse, serum, moisturiser, SPF.',
      'Evening: cleanse, serum, moisturiser.',
      'Do not decant. Use the bottles as supplied.',
    ],
    ingredients:
      'See the individual product pages for full ingredient lists.',
    keyIngredients: [
      { ingredientId: 'ing-niacinamide', note: 'Works across every skin type' },
      { ingredientId: 'ing-zinc', note: 'SPF is the step most often forgotten while travelling' },
    ],
    gallery: [
      [4202325, 'Assorted cosmetic bottles on a marble shelf against a beige wall'],
      [10574130, 'Elegant bathroom setup with cosmetic bottles and a basket of toiletries'],
      [7691166, 'Elegant display of skincare products on a white surface'],
    ],
    badges: [['Save 29%', 'clay']],
    stock: 96,
    relatedProductIds: ['prod-softening-milk-cleanser', 'prod-niacinamide-serum', 'prod-invisible-fluid-spf'],
    frequentlyBoughtWithIds: ['prod-invisible-fluid-spf'],
    position: 28,
    createdAt: '2026-04-02T09:00:00.000Z',
  }),
];
