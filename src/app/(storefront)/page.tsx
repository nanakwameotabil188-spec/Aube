import type { Metadata } from 'next';
import { contentService } from '@/lib/services/content-service';
import { SectionRenderer } from '@/components/home/SectionRenderer';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await contentService.getSettings();
  return {
    title: { absolute: `${settings.brandName} — ${settings.tagline}` },
    description: settings.description,
    alternates: { canonical: '/' },
  };
}

export default async function HomePage() {
  const [sections, settings] = await Promise.all([contentService.getResolvedHomeSections(), contentService.getSettings()]);

  // A hero section supplies the page's visible `h1`. Only when an admin has
  // disabled the hero do we need a visually hidden one, so the document never
  // ships two `h1` elements.
  const hasHero = sections.some((entry) => entry.type === 'hero');

  return (
    <>
      {!hasHero && <h1 className="sr-only">{`${settings.brandName} — ${settings.tagline}`}</h1>}
      {sections.map((entry, index) => (
        <SectionRenderer key={entry.section.id} entry={entry} index={index} />
      ))}
    </>
  );
}
