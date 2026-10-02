import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { contentService } from '@/lib/services/content-service';
import { productService } from '@/lib/services/catalog-service';
import { routes } from '@/lib/routes';
import { formatDate } from '@/lib/utils/format';
import { Breadcrumbs } from '@/components/ui/states';
import { MediaImage } from '@/components/commerce/ProductGallery';
import { ProductRail } from '@/components/commerce/ProductCard';
import { Icon } from '@/components/ui/Icon';
import { JsonLd, articleLd, breadcrumbLd } from '@/lib/seo/structured-data';
import { catalogMetadata } from '@/components/catalog/CatalogPage';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const posts = await contentService.getJournalPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await contentService.getJournalPost((await params).slug);
  if (!post) return { title: 'Article not found' };

  return catalogMetadata({
    title: post.title,
    description: post.excerpt,
    path: routes.journal.post(post.slug),
    image: post.image.url,
  });
}

/**
 * Journal article.
 *
 * A long-form body assembled from `post.body` rather than markdown, so the
 * structure is typed and a CMS can reorder it. Related products are resolved
 * from whatever the post references.
 */
export default async function JournalPostPage({ params }: Params) {
  const { slug } = await params;
  const post = await contentService.getJournalPost(slug);
  if (!post) notFound();

  const crumbs = [
    { label: 'Home', href: routes.home },
    { label: 'Journal', href: routes.journal.index },
    { label: post.title },
  ];

  const [relatedProducts, more, settings] = await Promise.all([
    productService.getManyByIds(post.productIds),
    contentService.getJournalPosts(),
    contentService.getSettings(),
  ]);

  const alsoRead = more.filter((item) => item.id !== post.id && item.category === post.category).slice(0, 3);
  const fallbacks = more.filter((item) => item.id !== post.id).slice(0, 3);
  const suggested = alsoRead.length > 0 ? alsoRead : fallbacks;

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd
        data={articleLd(post.title, post.excerpt, post.image.url, post.publishedAt, post.author, settings.brandName)}
      />

      <article className="container-page py-8 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <Breadcrumbs items={crumbs} className="mb-10" />

          <header className="mb-10">
            <p className="flex flex-wrap items-center gap-2 text-2xs uppercase tracking-[0.14em] text-muted">
              <span className="text-moss">{post.category.replace('-', ' ')}</span>
              <span aria-hidden className="text-line-strong">
                ·
              </span>
              <span>{post.readingTimeMinutes} min read</span>
              <span aria-hidden className="text-line-strong">
                ·
              </span>
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            </p>
            <h1 className="mt-5 font-display text-4xl leading-[1.08] text-ink sm:text-5xl">{post.title}</h1>
            <p className="mt-5 text-md leading-relaxed text-muted">{post.excerpt}</p>
            <p className="mt-6 border-t border-line pt-5 text-sm text-muted">
              Written by <span className="text-ink">{post.author}</span>
            </p>
          </header>
        </div>

        <div className="mx-auto max-w-4xl">
          <MediaImage
            image={post.image}
            aspect="16/9"
            priority
            rounded="rounded-md"
            sizes="(min-width: 1024px) 56rem, 100vw"
          />
        </div>

        <div className="mx-auto mt-14 max-w-3xl">
          <div className="flex flex-col gap-10">
            {post.body.map((section) => (
              <section key={section.id}>
                {section.heading && (
                  <h2 className="mb-4 font-display text-2xl leading-tight text-ink sm:text-3xl">{section.heading}</h2>
                )}
                <div className="flex flex-col gap-4">
                  {/* Section bodies are stored as one string with blank-line
                      paragraph breaks, so long-form copy stays editable as
                      plain text rather than a nested array. */}
                  {section.body.split('\n\n').map((paragraph) => (
                    <p key={paragraph.slice(0, 40)} className="text-lg leading-relaxed text-ink-soft">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {section.list && section.list.length > 0 && (
                  <ul className="mt-5 flex flex-col gap-2.5 border-l-2 border-moss pl-5">
                    {section.list.map((item) => (
                      <li key={item} className="text-base leading-relaxed text-ink-soft">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {section.pullQuote && (
                  <blockquote className="my-8 border-l-2 border-ink pl-6">
                    <p className="font-display text-xl leading-snug text-ink sm:text-2xl">{section.pullQuote}</p>
                  </blockquote>
                )}

                {section.image && (
                  <MediaImage
                    image={section.image}
                    aspect="4/3"
                    rounded="rounded-md"
                    sizes="(min-width: 768px) 48rem, 100vw"
                    className="mt-6"
                  />
                )}
              </section>
            ))}
          </div>

          {relatedProducts.length > 0 && (
            <aside className="mt-16 rounded-md bg-moss p-8 text-shell sm:p-10">
              <h2 className="font-display text-2xl">Mentioned in this article</h2>
              <ul className="mt-6 flex flex-col divide-y divide-shell/15">
                {relatedProducts.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={routes.product(product.slug)}
                      className="group/ref flex items-center justify-between gap-4 py-4 transition-opacity hover:opacity-80"
                    >
                      <span>
                        <span className="block font-medium">{product.name}</span>
                        <span className="mt-0.5 block text-sm text-shell/70">{product.subtitle}</span>
                      </span>
                      <Icon
                        name="arrow-right"
                        size={16}
                        aria-hidden
                        className="shrink-0 transition-transform duration-300 group-hover/ref:translate-x-1"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <footer className="mt-16 border-t border-line pt-8">
            <p className="text-sm leading-relaxed text-muted">
              This article is general information, not medical advice. For a specific skin condition, speak to a dermatologist.{' '}
              <Link href={routes.contact} className="underline underline-offset-2">
                Contact us
              </Link>{' '}
              if you have a question about a product.
            </p>
          </footer>
        </div>
      </article>

      {suggested.length > 0 && (
        <section className="container-page mt-24 border-t border-line pt-16">
          <h2 className="mb-8 font-display text-2xl text-ink sm:text-3xl">Keep reading</h2>
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {suggested.map((item) => (
              <li key={item.id}>
                <article className="group/post">
                  <Link href={routes.journal.post(item.slug)} className="block">
                    <MediaImage
                      image={item.image}
                      aspect="4/3"
                      rounded="rounded-xs"
                      sizes="(min-width: 1024px) 30vw, 90vw"
                      className="transition-transform duration-500 ease-[var(--ease-soft)] group-hover/post:scale-[1.02]"
                    />
                  </Link>
                  <h3 className="mt-4 font-display text-lg leading-snug text-ink">
                    <Link href={routes.journal.post(item.slug)} className="transition-colors hover:text-moss">
                      {item.title}
                    </Link>
                  </h3>
                  <p className="mt-1.5 text-xs text-muted-light">{item.readingTimeMinutes} min read</p>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}

      {relatedProducts.length > 0 && (
        <section className="container-page mt-24">
          <ProductRail products={relatedProducts} />
        </section>
      )}
    </>
  );
}

