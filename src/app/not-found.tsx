import { NotFoundPage } from '@/components/NotFoundPage';

/**
 * Global 404, for URLs that match no route at all.
 *
 * Next.js only honours a custom not-found page at the app root, so this
 * boundary has to exist here as well as in the storefront group. It renders
 * inside the thin root layout, without the shopper header and footer.
 */
export default function NotFound() {
  return <NotFoundPage showBestsellers={false} />;
}
