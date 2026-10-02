import { NotFoundPage } from '@/components/NotFoundPage';

/**
 * Storefront 404, for `notFound()` calls from inside a storefront route. The
 * shell above it is already rendered, so this renders as a normal page.
 */
export default function NotFound() {
  return <NotFoundPage />;
}
