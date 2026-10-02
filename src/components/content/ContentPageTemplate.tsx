import type { ContentPage } from '@/types';
import { routes } from '@/lib/routes';
import { Breadcrumbs } from '@/components/ui/states';
import { MediaImage } from '@/components/commerce/ProductGallery';
import { Icon } from '@/components/ui/Icon';
import { JsonLd, breadcrumbLd } from '@/lib/seo/structured-data';

/**
 * Long-form content page.
 *
 * One template for about, contact and the five policies. Each is a content
 * record, so adding a policy is a data change plus a route entry — not a new
 * template. Sections are authored as `heading` + body paragraphs + optional
 * list, which covers the shape of every page here.
 */
export function ContentPageTemplate({ page, crumbLabel }: { page: ContentPage; crumbLabel: string }) {
  const crumbs = [
    { label: 'Home', href: routes.home },
    { label: crumbLabel },
  ];

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />

      <div className="container-page py-10 sm:py-16">
        <Breadcrumbs items={crumbs} className="mb-10" />

        <header className="mb-14 max-w-2xl">
          <p className="eyebrow mb-3">{page.eyebrow}</p>
          <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">{page.title}</h1>
          <p className="mt-5 text-md leading-relaxed text-muted">{page.intro}</p>
        </header>

        {page.heroImage && (
          <div className="mb-16">
            <MediaImage
              image={page.heroImage}
              aspect="16/9"
              priority
              rounded="rounded-md"
              sizes="100vw"
            />
          </div>
        )}

        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col gap-12">
            {page.sections.map((section) => (
              <section key={section.id}>
                <h2 className="mb-4 font-display text-2xl leading-tight text-ink sm:text-3xl">{section.heading}</h2>
                <div className="flex flex-col gap-4">
                  {section.body.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)} className="text-base leading-relaxed text-ink-soft">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {section.list && section.list.length > 0 && (
                  <ul className="mt-5 flex flex-col gap-2.5">
                    {section.list.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-base leading-relaxed text-ink-soft">
                        <Icon name="check" size={15} aria-hidden className="mt-1 shrink-0 text-moss" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
