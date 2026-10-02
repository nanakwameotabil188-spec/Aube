import type { Metadata } from 'next';
import { contentService } from '@/lib/services/content-service';
import { routes } from '@/lib/routes';
import { Breadcrumbs } from '@/components/ui/states';
import { Accordion } from '@/components/ui/overlays';
import { Icon } from '@/components/ui/Icon';
import { NewsletterForm } from '@/components/layout/NewsletterForm';
import { JsonLd, breadcrumbLd, faqLd } from '@/lib/seo/structured-data';
import { catalogMetadata } from '@/components/catalog/CatalogPage';

export const metadata: Metadata = catalogMetadata({
  title: 'Questions, answered',
  description:
    'Shipping, returns, ingredients, how to build a routine that lasts, and what to do when something is not right.',
  path: routes.faq,
});

/**
 * FAQ.
 *
 * Grouped by topic and published as FAQPage structured data. Google requires
 * an exact question-and-answer match to the visible text, so both are rendered
 * from the same records rather than written twice.
 */

const GROUPS = [
  { key: 'products', label: 'Products' },
  { key: 'skin', label: 'Skin' },
  { key: 'orders', label: 'Orders & payment' },
  { key: 'shipping', label: 'Shipping & returns' },
] as const;

export default async function FaqPage() {
  const [all, settings] = await Promise.all([contentService.getFaqItems(), contentService.getSettings()]);
  const crumbs = [
    { label: 'Home', href: routes.home },
    { label: 'FAQ' },
  ];

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      <JsonLd data={faqLd(all)} />

      <div className="container-page py-10 sm:py-16">
        <Breadcrumbs items={crumbs} className="mb-10" />

        <header className="mb-14 max-w-2xl">
          <p className="eyebrow mb-3">Support</p>
          <h1 className="font-display text-4xl leading-[1.05] text-ink sm:text-5xl">Questions, answered</h1>
          <p className="mt-4 text-md leading-relaxed text-muted">
            If something is not covered here, write to us. A person reads every message.
          </p>
        </header>

        <div className="flex flex-col gap-14">
          {GROUPS.map((group) => {
            const items = all.filter((item) => item.group === group.key);
            if (items.length === 0) return null;

            return (
              <section key={group.key} className="grid gap-6 lg:grid-cols-[14rem_1fr] lg:gap-14">
                <h2 className="text-sm uppercase tracking-[0.14em] text-muted lg:pt-4">{group.label}</h2>
                <Accordion
                  items={items.map((item) => ({
                    id: item.id,
                    title: item.question,
                    content: <p className="max-w-prose leading-relaxed">{item.answer}</p>,
                  }))}
                />
              </section>
            );
          })}
        </div>

        <section className="mt-20 flex flex-col items-start gap-6 rounded-md bg-moss p-8 text-shell sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-2xl">Still stuck?</h2>
            <p className="max-w-md text-sm leading-relaxed text-shell/75">
              Email {settings.supportEmail} and we will reply within one working day, usually sooner.
            </p>
          </div>
          <a
            href={`mailto:${settings.supportEmail}`}
            className="inline-flex shrink-0 items-center gap-2 border-b border-shell/40 pb-1 text-sm transition-colors hover:border-shell"
          >
            Email us
            <Icon name="arrow-right" size={14} aria-hidden />
          </a>
        </section>

        <section className="mt-20 border-t border-line pt-14">
          <div className="mx-auto max-w-xl">
            <h2 className="font-display text-2xl text-ink">One letter a month</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Formulation notes and early access. Unsubscribe in one click.
            </p>
            <div className="mt-8">
              <NewsletterForm incentive="15% off your first order" consentCopy="Unsubscribe in one click." />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

