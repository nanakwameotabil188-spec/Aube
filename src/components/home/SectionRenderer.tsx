import Image from 'next/image';
import Link from 'next/link';
import type {
  Category,
  CategoryTilesSection,
  CategoryShowcaseSection,
  Collection,
  CollectionFeatureSection,
  ConcernTilesSection,
  EditorialSplitSection,
  FaqItem,
  FaqSection,
  HeroSection,
  IconName,
  Ingredient,
  IngredientStripSection,
  JournalPost,
  JournalSectionType,
  NewsletterSection,
  Product,
  ProductRailSection,
  PromoBannerSection,
  Promotion,
  RoutineSection,
  TestimonialSection,
  ValueStripSection,
} from '@/types';
import type { ResolvedSection, ResolvedTestimonial } from '@/lib/services/content-service';
import { cn } from '@/lib/utils/cn';
import { routes } from '@/lib/routes';
import { formatDate } from '@/lib/utils/format';
import { Icon } from '@/components/ui/Icon';
import { LinkButton } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/primitives';
import { Accordion } from '@/components/ui/overlays';
import { ProductCard, ProductRail } from '@/components/commerce/ProductCard';
import { MediaImage } from '@/components/commerce/ProductGallery';
import { TestimonialCard } from '@/components/commerce/Reviews';
import { NewsletterForm } from '@/components/layout/NewsletterForm';

/**
 * Section renderer.
 *
 * The homepage is a list of records; this switch maps each `section.type` to a
 * component. Reordering, hiding, retitling or adding a section is a content
 * operation, not a code change. `ResolvedSection` is a discriminated union, so
 * adding a new `type` makes the compiler point at every place that must handle
 * it. Exhaustive by construction — no `default` branch that silently drops a
 * section an admin enabled.
 */

/** Concern tile payload: the term plus how many products carry it. */
type ConcernWithCount = { id: string; name: string; slug: string; shortDescription: string; icon?: string; productCount: number };

/** Value prop, as stored either on the section or at store level. */
type ValueProp = NonNullable<ValueStripSection['items']>[number];
export function SectionRenderer({ entry, index }: { entry: ResolvedSection; index: number }) {
  const { section } = entry;

  return (
    <section
      data-section-id={section.id}
      data-section-type={section.type}
      data-section-position={section.position}
      id={section.id}
      className={cn('animate-fade-up', SURFACE[section.theme ?? 'default'])}
      style={{ animationDelay: `${Math.min(index, 4) * 40}ms` }}
    >
      <SectionBody entry={entry} />
    </section>
  );
}

function SectionBody({ entry }: { entry: ResolvedSection }) {
  switch (entry.type) {
    case 'hero':
      return <Hero section={entry.section} />;
    case 'product-rail':
      return <ProductRailSection section={entry.section} products={entry.products} />;
    case 'collection-feature':
      return <CollectionFeature section={entry.section} collection={entry.collection} products={entry.products} />;
    case 'category-tiles':
      return <CategoryTiles section={entry.section} terms={entry.terms} />;
    case 'category-showcase':
      return <CategoryShowcase section={entry.section} groups={entry.groups} />;
    case 'concern-tiles':
      return <ConcernTiles section={entry.section} concerns={entry.concerns} />;
    case 'ingredient-strip':
      return <IngredientStrip section={entry.section} ingredients={entry.ingredients} />;
    case 'editorial-split':
      return <EditorialSplit section={entry.section} />;
    case 'value-strip':
      return <ValueStrip section={entry.section} items={entry.items} />;
    case 'testimonials':
      return <Testimonials section={entry.section} items={entry.items} />;
    case 'journal':
      return <Journal section={entry.section} posts={entry.posts} />;
    case 'faq':
      return <Faq section={entry.section} items={entry.items} />;
    case 'routine':
      return <Routine section={entry.section} steps={entry.steps} />;
    case 'promo-banner':
      return <PromoBanner section={entry.section} promotion={entry.promotion} />;
    case 'newsletter':
      return <Newsletter section={entry.section} />;
  }
}

const SURFACE: Record<string, string> = {
  default: 'bg-porcelain',
  sand: 'bg-sand',
  oat: 'bg-oat/50',
  moss: 'bg-moss text-shell',
  ink: 'bg-ink text-shell',
};

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero({ section }: { section: HeroSection }) {
  const lines = section.title?.split('\n') ?? [];

  if (section.layout === 'centered') {
    return (
      <div className="container-page flex flex-col items-center gap-6 py-20 text-center sm:py-28">
        {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
        <h1 className="max-w-4xl font-display text-5xl leading-[0.98] text-ink sm:text-6xl lg:text-7xl">
          {lines.map((line, index) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        {section.subtitle && <p className="max-w-xl text-lg leading-relaxed text-muted">{section.subtitle}</p>}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
          {section.cta && <LinkButton href={section.cta.href}>{section.cta.label}</LinkButton>}
          {section.secondaryCta && (
            <LinkButton href={section.secondaryCta.href} variant="text">
              {section.secondaryCta.label}
            </LinkButton>
          )}
        </div>
        {section.image && (
          <div className="mt-6 w-full">
            <MediaImage image={section.image} aspect="16/9" priority rounded="rounded-md" sizes="100vw" />
          </div>
        )}
      </div>
    );
  }

  if (section.layout === 'full-bleed') {
    return (
      <div className="relative isolate flex min-h-[76vh] items-end overflow-hidden">
        {section.image && (
          <Image
            src={section.image.url}
            alt={section.image.alt}
            fill
            priority
            sizes="100vw"
            className="-z-10 object-cover"
          />
        )}
        <div
          className={cn(
            'absolute inset-0 -z-10',
            section.overlay === 'strong'
              ? 'bg-ink/60'
              : section.overlay === 'soft'
                ? 'bg-ink/20'
                : 'bg-gradient-to-t from-ink/70 via-ink/25 to-transparent',
          )}
        />
        <div className="container-page w-full py-16 sm:py-20">
          <div className="max-w-2xl">
            {section.eyebrow && <p className="eyebrow mb-4 text-shell/80">{section.eyebrow}</p>}
            <h1 className="font-display text-4xl leading-[1.02] text-shell sm:text-6xl">
              {lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            {section.subtitle && <p className="mt-5 max-w-lg text-lg leading-relaxed text-shell/85">{section.subtitle}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {section.cta && (
                <LinkButton href={section.cta.href} className="bg-shell text-ink hover:bg-sand">
                  {section.cta.label}
                </LinkButton>
              )}
              {section.secondaryCta && (
                <LinkButton href={section.secondaryCta.href} variant="text" className="text-shell">
                  {section.secondaryCta.label}
                </LinkButton>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-24">
      <div className="order-2 flex flex-col gap-6 lg:order-1">
        {section.eyebrow && (
          <p className="eyebrow">
            <span className="mr-3 inline-block h-px w-8 translate-y-[-0.3em] bg-current align-middle opacity-50" />
            {section.eyebrow}
          </p>
        )}
        <h1 className="font-display text-4xl leading-[1.03] text-ink sm:text-5xl lg:text-6xl">
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        {section.subtitle && (
          <p className="max-w-lg text-lg leading-relaxed text-muted">{section.subtitle}</p>
        )}
        <div className="flex flex-wrap items-center gap-5 pt-1">
          {section.cta && <LinkButton href={section.cta.href}>{section.cta.label}</LinkButton>}
          {section.secondaryCta && (
            <LinkButton href={section.secondaryCta.href} variant="text">
              {section.secondaryCta.label}
            </LinkButton>
          )}
        </div>
        {section.image && section.stats && section.stats.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-6">
            {section.stats.map((stat) => (
              <Stat key={stat.label} value={stat.value} label={stat.label} />
            ))}
          </div>
        )}
      </div>

      <div className="order-1 lg:order-2">
        {section.image && (
          <MediaImage
            image={section.image}
            aspect="4/5"
            priority
            rounded="rounded-md"
            sizes="(min-width: 1024px) 46vw, 100vw"
          />
        )}
        {section.secondaryImage && (
          <div className="mt-4 hidden justify-end lg:flex">
            <MediaImage
              image={section.secondaryImage}
              aspect="1/1"
              rounded="rounded-md"
              className="w-40"
              sizes="10rem"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-xl text-ink">{value}</span>
      <span className="text-2xs uppercase tracking-[0.12em] text-muted">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Product rail                                                        */
/* ------------------------------------------------------------------ */

function ProductRailSection({ section, products }: { section: ProductRailSection; products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeader
        eyebrow={section.eyebrow}
        title={section.title}
        subtitle={section.subtitle}
        cta={section.cta}
        theme={section.theme}
        className="mb-10"
      />
      <ProductRail products={products} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Collection feature                                                  */
/* ------------------------------------------------------------------ */

function CollectionFeature({
  section,
  collection,
  products,
}: {
  section: CollectionFeatureSection;
  collection: Collection | null;
  products: Product[];
}) {
  const dark = section.theme === 'ink' || section.theme === 'moss';
  const featured = collection?.featuredProductId
    ? products.find((product) => product.id === collection.featuredProductId)
    : products[0];

  if (section.layout === 'split') {
    return (
      <div className="container-page py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {section.image && (
            <MediaImage
              image={section.image}
              aspect="4/3"
              rounded="rounded-md"
              sizes="(min-width: 1024px) 46vw, 100vw"
            />
          )}
          <div className="flex flex-col gap-5">
            {section.eyebrow && <p className={cn('eyebrow', dark && 'text-shell/70')}>{section.eyebrow}</p>}
            {section.title && (
              <h2 className={cn('font-display text-3xl leading-tight sm:text-4xl', dark ? 'text-shell' : 'text-ink')}>
                {section.title}
              </h2>
            )}
            {section.subtitle && (
              <p className={cn('text-md leading-relaxed', dark ? 'text-shell/75' : 'text-muted')}>{section.subtitle}</p>
            )}
            {collection?.story && (
              <p className={cn('text-sm leading-relaxed', dark ? 'text-shell/60' : 'text-muted-light')}>
                {collection.story}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              {section.cta && <LinkButton href={section.cta.href}>{section.cta.label}</LinkButton>}
              {featured && (
                <LinkButton
                  href={routes.product(featured.slug)}
                  variant={dark ? 'text' : 'secondary'}
                  className={cn(dark && 'text-shell')}
                >
                  Shop {featured.name}
                </LinkButton>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-6">
          {section.eyebrow && <p className={cn('eyebrow', dark && 'text-shell/70')}>{section.eyebrow}</p>}
          {section.title && (
            <h2 className={cn('font-display text-3xl leading-[1.1] sm:text-5xl', dark ? 'text-shell' : 'text-ink')}>
              {section.title}
            </h2>
          )}
          {section.subtitle && (
            <p className={cn('max-w-lg text-md leading-relaxed', dark ? 'text-shell/75' : 'text-muted')}>
              {section.subtitle}
            </p>
          )}
          {section.cta && (
            <div className="pt-1">
              <LinkButton href={section.cta.href} className={cn(dark && 'bg-shell text-ink hover:bg-sand')}>
                {section.cta.label}
              </LinkButton>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-5">
          {products.slice(0, 2).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              variant="compact"
              showQuickAdd={false}
              className="[&_h3]:text-base"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category + concern tiles                                            */
/* ------------------------------------------------------------------ */

function CategoryTiles({ section, terms }: { section: CategoryTilesSection; terms: Category[] }) {
  if (terms.length === 0) return null;

  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeader
        eyebrow={section.eyebrow}
        title={section.title}
        subtitle={section.subtitle}
        cta={section.cta}
        theme={section.theme}
        className="mb-10"
      />
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
        {terms.map((term, index) => (
          <li key={term.id}>
            <Link href={routes.category(term.slug)} className="group/tile block">
              {term.image && section.variant !== 'minimal' && (
                <MediaImage
                  image={term.image}
                  aspect="1/1"
                  rounded="rounded-xs"
                  sizes="(min-width: 1024px) 22vw, 45vw"
                  className="transition-transform duration-500 ease-[var(--ease-soft)] group-hover/tile:scale-[1.02]"
                />
              )}
              <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-line pt-3">
                <h3 className="font-display text-lg leading-snug text-ink transition-colors group-hover/tile:text-moss">
                  {term.name}
                </h3>
                <span className="text-xs tabular-nums text-muted">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted">{term.shortDescription}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One row per category, each showing that category's own products.
 *
 * The rows and the products inside them come entirely from the category
 * records — nothing here names a category or a product, so the section follows
 * the catalogue as it is edited. A category whose products are all hidden
 * arrives here with an empty list and the resolver drops it, so this can never
 * render a heading with nothing under it.
 */
function CategoryShowcase({
  section,
  groups,
}: {
  section: CategoryShowcaseSection;
  groups: { category: Category; products: Product[] }[];
}) {
  if (groups.length === 0) return null;

  return (
    <div className="container-page space-y-14 py-16 sm:space-y-16 sm:py-20">
      <SectionHeader
        eyebrow={section.eyebrow}
        title={section.title}
        subtitle={section.subtitle}
        cta={section.cta}
        theme={section.theme}
      />

      {groups.map((group) => (
        <section key={group.category.id} aria-labelledby={`cat-${group.category.id}`}>
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-3">
            <h3 id={`cat-${group.category.id}`} className="font-display text-2xl text-ink">
              {group.category.name}
            </h3>
            <Link
              href={routes.category(group.category.slug)}
              className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink"
            >
              All {group.category.name.toLowerCase()}
            </Link>
          </div>

          <ProductRail products={group.products} />
        </section>
      ))}
    </div>
  );
}

function ConcernTiles({ section, concerns }: { section: ConcernTilesSection; concerns: ConcernWithCount[] }) {  if (concerns.length === 0) return null;

  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeader
        eyebrow={section.eyebrow}
        title={section.title}
        subtitle={section.subtitle}
        theme={section.theme}
        className="mb-10"
      />
      <ul className="rail">
        {concerns.map((concern) => (
          <li key={concern.id}>
            <Link
              href={routes.concern(concern.slug)}
              className="group/tile flex h-full flex-col justify-between gap-6 border-t-2 border-ink/15 bg-shell p-6 transition-colors duration-300 hover:border-ink"
            >
              <div className="flex flex-col gap-3">
                <Icon name={(concern.icon ?? 'sparkle') as IconName} size={22} aria-hidden className="text-moss" />
                <h3 className="font-display text-2xl leading-snug text-ink">{concern.name}</h3>
                <p className="text-sm leading-relaxed text-muted">{concern.shortDescription}</p>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-4">
                <span className="text-xs tabular-nums text-muted">
                  {concern.productCount} {concern.productCount === 1 ? 'product' : 'products'}
                </span>
                <Icon
                  name="arrow-right"
                  size={16}
                  aria-hidden
                  className="text-ink transition-transform duration-300 group-hover/tile:translate-x-1"
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ingredient strip                                                    */
/* ------------------------------------------------------------------ */

function IngredientStrip({ section, ingredients }: { section: IngredientStripSection; ingredients: Ingredient[] }) {
  if (ingredients.length === 0) return null;

  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeader
        eyebrow={section.eyebrow}
        title={section.title}
        subtitle={section.subtitle}
        cta={section.cta}
        theme={section.theme}
        className="mb-10"
      />
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xs border border-line bg-line sm:grid-cols-4">
        {ingredients.map((ingredient) => (
          <li key={ingredient.id}>
            <Link
              href={routes.ingredient(ingredient.slug)}
              className="group/ing flex h-full flex-col gap-2 bg-shell p-5 transition-colors duration-300 hover:bg-sand"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="eyebrow-tight text-muted">{ingredient.concentration ?? 'Ingredient'}</span>
                <Icon
                  name="arrow-right"
                  size={14}
                  aria-hidden
                  className="text-muted opacity-0 transition-opacity duration-300 group-hover/ing:opacity-100"
                />
              </span>
              <span className="font-display text-xl leading-snug text-ink">{ingredient.name}</span>
              <span className="text-xs leading-relaxed text-muted">{ingredient.shortDescription}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editorial split                                                     */
/* ------------------------------------------------------------------ */

function EditorialSplit({ section }: { section: EditorialSplitSection }) {
  const imageSide = section.imagePosition === 'left';

  return (
    <div className="container-page py-16 sm:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
        {section.image && (
          <MediaImage
            image={section.image}
            aspect="4/3"
            rounded="rounded-md"
            sizes="(min-width: 1024px) 46vw, 100vw"
            className={cn(imageSide ? 'lg:order-1' : 'lg:order-2')}
          />
        )}

        <div className={cn('flex flex-col gap-5', imageSide ? 'lg:order-2' : 'lg:order-1')}>
          {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
          {section.title && (
            <h2 className="font-display text-2xl leading-[1.2] text-ink sm:text-3xl lg:text-4xl">{section.title}</h2>
          )}
          {section.body &&
            section.body.split('\n\n').map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="text-md leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}

          {section.points && section.points.length > 0 && (
            <dl className="mt-2 grid gap-5 border-t border-line pt-6 sm:grid-cols-2">
              {section.points.map((point) => (
                <div key={point.id}>
                  <dt className="text-sm font-medium text-ink">{point.title}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-muted">{point.body}</dd>
                </div>
              ))}
            </dl>
          )}

          {section.cta && (
            <div className="pt-2">
              <LinkButton href={section.cta.href} variant={section.cta.style === 'primary' ? 'primary' : 'text'}>
                {section.cta.label}
              </LinkButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Value strip                                                         */
/* ------------------------------------------------------------------ */

function ValueStrip({ section, items }: { section: ValueStripSection; items: ValueProp[] }) {
  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeader
        eyebrow={section.eyebrow}
        title={section.title}
        subtitle={section.body}
        theme={section.theme}
        className="mb-12"
      />
      <ul className="grid gap-px overflow-hidden rounded-xs bg-shell/15 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => (
          <li key={item.id} className="flex flex-col gap-3 bg-ink p-6 text-shell lg:p-8">
            <span className="flex items-center justify-between">
              <Icon name={item.icon as IconName} size={22} aria-hidden className="text-shell/80" />
              <span className="text-2xs tabular-nums text-shell/40">{String(index + 1).padStart(2, '0')}</span>
            </span>
            <h3 className="font-display text-xl leading-snug">{item.title}</h3>
            <p className="text-sm leading-relaxed text-shell/70">{item.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */

function Testimonials({ section, items }: { section: TestimonialSection; items: ResolvedTestimonial[] }) {
  if (items.length === 0) return null;

  return (
    <div className="container-page py-16 sm:py-24">
      <SectionHeader
        eyebrow={section.eyebrow}
        title={section.title}
        subtitle={section.subtitle}
        theme={section.theme}
        className="mb-12"
      />
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className="h-full">
            <TestimonialCard
              quote={item.quote}
              author={item.author}
              location={item.location}
              product={item.product}
              tone="muted"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

function Journal({ section, posts }: { section: JournalSectionType; posts: JournalPost[] }) {  if (posts.length === 0) return null;
  const columns = section.columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeader
        eyebrow={section.eyebrow}
        title={section.title}
        subtitle={section.subtitle}
        cta={section.cta}
        theme={section.theme}
        className="mb-10"
      />
      <ul className={cn('grid gap-x-6 gap-y-10', columns)}>
        {posts.map((post, index) => (
          <li key={post.id}>
            <article className="group/post">
              <Link href={routes.journal.post(post.slug)} className="block">
                <MediaImage
                  image={post.image}
                  aspect="4/3"
                  rounded="rounded-xs"
                  sizes="(min-width: 1024px) 30vw, 90vw"
                  className="transition-transform duration-500 ease-[var(--ease-soft)] group-hover/post:scale-[1.02]"
                />
              </Link>
              <div className="mt-4 flex flex-col gap-2">
                <p className="flex items-center gap-2 text-2xs uppercase tracking-[0.14em] text-muted">
                  <span className="text-moss">{post.category.replace('-', ' ')}</span>
                  <span aria-hidden className="text-line-strong">
                    ·
                  </span>
                  <span>{post.readingTimeMinutes} min read</span>
                </p>
                <h3 className="font-display text-xl leading-snug text-ink">
                  <Link href={routes.journal.post(post.slug)} className="transition-colors hover:text-moss">
                    {post.title}
                  </Link>
                </h3>
                <p className="text-sm leading-relaxed text-muted">{post.excerpt}</p>
                <p className="pt-1 text-xs text-muted-light">
                  {post.author} · {formatDate(post.publishedAt)}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

function Faq({ section, items }: { section: FaqSection; items: FaqItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="container-page py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <div className="flex flex-col gap-4">
          <p className="eyebrow">{section.eyebrow}</p>
          {section.title && <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{section.title}</h2>}
          {section.subtitle && <p className="max-w-md text-md leading-relaxed text-muted">{section.subtitle}</p>}
          <LinkButton href={routes.faq} variant="secondary" className="mt-2 w-fit">
            All questions
          </LinkButton>
        </div>
        <Accordion
          items={items.map((item) => ({
            id: item.id,
            title: item.question,
            content: <p className="max-w-prose">{item.answer}</p>,
          }))}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Routine                                                             */
/* ------------------------------------------------------------------ */

function Routine({
  section,
  steps,
}: {
  section: RoutineSection;
  steps: { id: string; step: number; title: string; body: string; products: Product[] }[];
}) {
  if (steps.length === 0) return null;

  return (
    <div className="container-page py-16 sm:py-20">
      <SectionHeader
        eyebrow={section.eyebrow}
        title={section.title}
        subtitle={section.subtitle}
        theme={section.theme}
        className="mb-12"
      />
      <ol className="grid gap-px overflow-hidden rounded-xs border border-line bg-line lg:grid-cols-4">
        {steps.map((step) => (
          <li key={step.id} className="flex flex-col gap-4 bg-porcelain p-6 lg:p-7">
            <span className="font-display text-4xl leading-none text-line-strong">
              {String(step.step).padStart(2, '0')}
            </span>
            <div className="flex flex-col gap-2">
              <h3 className="font-display text-2xl leading-snug text-ink">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{step.body}</p>
            </div>
            {step.products.length > 0 && (
              <ul className="mt-auto flex flex-wrap gap-2 pt-2">
                {step.products.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={routes.product(product.slug)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-shell px-3 text-xs text-ink transition-colors hover:border-ink"
                    >
                      {product.name}
                      <Icon name="arrow-right" size={11} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Promo banner                                                        */
/* ------------------------------------------------------------------ */

function PromoBanner({ section, promotion }: { section: PromoBannerSection; promotion: Promotion | null }) {
  const dark = section.theme === 'ink' || section.theme === 'moss';

  return (
    <div className="container-page py-8">
      <div
        className={cn(
          'flex flex-col items-start gap-5 rounded-md px-6 py-10 sm:px-10 sm:py-14 lg:flex-row lg:items-center lg:justify-between',
          dark ? 'bg-ink text-shell' : 'bg-moss text-shell',
        )}
      >
        <div className="flex flex-col gap-3">
          {section.eyebrow && <p className="eyebrow text-shell/70">{section.eyebrow}</p>}
          {section.title && <h2 className="max-w-2xl font-display text-3xl leading-tight sm:text-4xl">{section.title}</h2>}
          {(promotion?.description || section.subtitle) && (
            <p className="max-w-xl text-base leading-relaxed text-shell/75">{promotion?.description ?? section.subtitle}</p>
          )}
        </div>
        {section.cta && (
          <LinkButton href={section.cta.href} className="shrink-0 bg-shell text-ink hover:bg-sand">
            {section.cta.label}
          </LinkButton>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Newsletter                                                          */
/* ------------------------------------------------------------------ */

function Newsletter({ section }: { section: NewsletterSection }) {
  return (
    <div className="container-page py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-20">
        <div className="flex flex-col gap-4">
          <p className="eyebrow">{section.eyebrow}</p>
          {section.title && <h2 className="font-display text-3xl leading-tight sm:text-4xl">{section.title}</h2>}
          {section.subtitle && <p className="max-w-md text-md leading-relaxed text-muted">{section.subtitle}</p>}
          {section.incentive && (
            <p className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-xs text-ink">
              <Icon name="gift" size={13} aria-hidden className="text-moss" />
              {section.incentive}
            </p>
          )}
        </div>

        <div className="lg:pt-4">
          <NewsletterForm
            incentive=""
            consentCopy={section.consentCopy}
            source="homepage"
            tone="dark"
          />
        </div>
      </div>
    </div>
  );
}
