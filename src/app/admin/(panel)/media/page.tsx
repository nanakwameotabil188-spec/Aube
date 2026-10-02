import { listMedia } from '@/lib/supabase/admin-content';
import { AdminGate } from '@/components/admin/AdminGate';
import { AdminEmpty } from '@/components/admin/AdminEmpty';
import { MediaLibrary } from '@/components/admin/MediaLibrary';
import { MediaUploader } from '@/components/admin/MediaUploader';

export const dynamic = 'force-dynamic';

export default async function AdminMediaPage() {
  return (
    <AdminGate>
      <MediaScreen />
    </AdminGate>
  );
}

async function MediaScreen() {
  const media = await listMedia();
  if (!media) {
    return <AdminEmpty reason="No connection" detail="The service role client is unavailable." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Media</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Uploads are stored in your own Supabase bucket and referenced by URL, so replacing an
          image never means editing source or losing a file that something still points at.
        </p>
      </div>

      <MediaUploader />
      <MediaLibrary media={media} />
    </div>
  );
}
