import Link from 'next/link';
import type { NavLink } from '@/types';
import { cn } from '@/lib/utils/cn';
import { Icon } from '@/components/ui/Icon';
import { MediaImage } from '@/components/commerce/ProductGallery';

/**
 * Mega menu.
 *
 * The panel layout is derived from the shape of the `NavLink` tree rather
 * than hardcoded per item: a single level renders as a simple list, a two
 * level tree renders as columns with a feature panel. Adding a nav item in
 * the CMS needs no changes here.
 */

export function MegaMenu({ item, onNavigate }: { item: NavLink; onNavigate?: () => void }) {
  if (!item.children?.length) return null;

  const nested = item.children.some((child) => child.children?.length);

  return (
    <div
      className={cn(
        'animate-fade absolute inset-x-0 top-full z-50 border-t border-line bg-porcelain shadow-lift',
        nested ? 'max-h-[calc(100vh-8rem)] overflow-y-auto' : '',
      )}
    >
      <div className="container-page py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr_18rem]">
          <div>
            <p className="eyebrow mb-5">{item.label}</p>
            {nested ? (
              <ul className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-3">
                {item.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={child.href}
                      onClick={onNavigate}
                      className="group/link mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-moss"
                    >
                      {child.label}
                      <Icon
                        name="arrow-right"
                        size={13}
                        aria-hidden
                        className="opacity-0 transition-[opacity,transform] duration-300 group-hover/link:translate-x-0.5 group-hover/link:opacity-60"
                      />
                    </Link>
                    {child.children && (
                      <ul className="space-y-1.5">
                        {child.children.map((grandchild) => (
                          <li key={grandchild.id}>
                            <Link
                              href={grandchild.href}
                              onClick={onNavigate}
                              className="text-sm text-muted transition-colors hover:text-ink"
                            >
                              {grandchild.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
                {item.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      href={child.href}
                      onClick={onNavigate}
                      className="text-sm text-ink transition-colors hover:text-moss"
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div aria-hidden className="hidden lg:block" />

          {item.feature && (
            <div>
              <Link
                href={item.feature.href}
                onClick={onNavigate}
                className="group/feature block"
                aria-label={item.feature.title}
              >
                <MediaImage
                  image={item.feature.image!}
                  aspect="4/3"
                  sizes="18rem"
                  className="transition-transform duration-500 ease-[var(--ease-soft)] group-hover/feature:scale-[1.02]"
                />
                {item.feature.eyebrow && (
                  <p className="eyebrow-tight mt-3 text-muted">{item.feature.eyebrow}</p>
                )}
                <p className="mt-1 font-display text-lg leading-snug text-ink transition-colors group-hover/feature:text-moss">
                  {item.feature.title}
                </p>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
