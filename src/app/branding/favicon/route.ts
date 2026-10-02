import { contentService } from '@/lib/services/content-service';

/**
 * Favicon.
 *
 * There was no favicon route at all: the admin had a "Favicon id" field that
 * stored a value nothing ever read, so a favicon set in the panel produced no
 * visible change anywhere. The field was decorative.
 *
 * This route is what makes it real. It reads the same brand record the rest of
 * the site does and redirects to whichever image the admin chose, so the
 * browser needs only this one stable URL and gets the current icon behind it —
 * there is no per-image path to publish and no rebuild when the icon changes.
 *
 * A redirect rather than a proxy on purpose: the icon is a public image already
 * served from storage, so streaming it through the app would add a hop and a
 * body for no gain.
 */

/** Cached briefly so a page load does not fan out into N icon requests. */
const CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';

export async function GET() {
  const settings = await contentService.getSettings();
  const favicon = settings.favicon?.url;

  if (!favicon) {
    // No icon chosen. 204 tells the browser to use whatever it has rather than
    // logging a 404 on every page view, which is noise nobody can act on.
    return new Response(null, { status: 204, headers: { 'Cache-Control': CACHE } });
  }

  return Response.redirect(favicon, 302);
}
