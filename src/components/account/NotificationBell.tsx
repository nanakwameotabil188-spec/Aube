'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markEveryNotificationRead, markNotificationsRead } from '@/lib/actions/messaging';
import type { NotificationItem } from '@/lib/supabase/notifications';
import { cn } from '@/lib/utils/cn';
import { Icon } from '@/components/ui/Icon';

/**
 * Notification bell and panel.
 *
 * Rendered from server-fetched notifications and then kept in local state, so
 * opening the panel and marking things read does not need a round trip that
 * would re-render the whole account chrome.
 *
 * Marking read calls the server, which is the only place authorisation is
 * enforced â€” the optimistic local update is a convenience, and it is rolled back
 * to the server's answer rather than being assumed correct.
 */

function toneClass(tone: string): string {
  if (tone === 'success') return 'bg-success-soft text-success';
  if (tone === 'warning') return 'bg-danger-soft text-danger';
  return 'bg-sand text-moss';
}

function relative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  return new Date(iso).toLocaleDateString();
}

export function NotificationBell({ initial }: { initial: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  /*
   * Re-sync when the server sends a new list.
   *
   * `useState(initial)` only reads its argument on the first render, so without
   * this the bell is frozen at whatever it was given when the page first loaded:
   * `router.refresh()` re-runs the layout on the server, fetches the rows, and
   * the component then quietly ignores them. Marking something read elsewhere —
   * or a notification arriving after the page was rendered — would never appear.
   *
   * Done during render rather than in an effect. The effect version is a second
   * render pass with a frame where the list is stale, and it is the pattern
   * React's own lint rule rejects. React documents this form for exactly this
   * case — "adjusting some state when a prop changes" — and re-renders
   * immediately, so it settles rather than looping: the second pass sees
   * `synced === initial` and stops.
   */
  const [synced, setSynced] = useState(initial);

  if (synced !== initial) {
    setSynced(initial);
    setItems(initial);
  }

  const unread = items.filter((item) => !item.read).length;

  const markOne = (id: string) => {
    // Captured from the render closure, which is the correct pre-update state.
    const before = items;

    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );

    startTransition(async () => {
      const ok = await markNotificationsRead([id]);

      // Rolled back to the server's answer rather than assumed correct: the
      // write is RLS-scoped, so "0 rows updated" is a real outcome and showing a
      // notification as read when it is not would be a lie.
      if (!ok) {
        setItems(before);
        return;
      }

      router.refresh();
    });
  };

  const markAll = () => {
    const before = items;

    setItems((current) => current.map((item) => ({ ...item, read: true })));

    startTransition(async () => {
      const ok = await markEveryNotificationRead();

      /*
       * Only rolled back when the server did not actually do it.
       *
       * The previous version restored `before` unconditionally, which meant the
       * badge went back up after every "Mark all read" and the button looked
       * broken. `markAllRead` returns how many rows it updated, so a genuine
       * failure is zero and a list with nothing unread is also zero — in the
       * latter case there is nothing to undo anyway, so restoring is a no-op.
       */
      if (ok === 0) setItems(before);

      router.refresh();
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          unread > 0
            ? `Notifications, ${unread} unread`
            : items.length > 0
              ? 'Notifications, none unread'
              : 'Notifications'
        }
        className="relative grid size-9 place-items-center rounded-full border border-line text-ink transition-colors hover:bg-sand"
      >
        <Icon name="bell" size={16} aria-hidden />
        {unread > 0 ? (
          <span
            className="absolute -right-1 -top-1 grid min-w-4.5 place-items-center rounded-full bg-danger px-1 text-[10px] font-medium text-porcelain"
            aria-hidden
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          {/* Click-outside layer. A backdrop button rather than a document listener. */}
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 z-20 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-md border border-line bg-porcelain shadow-lg">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold">Notifications</h2>
              {unread > 0 ? (
                <button
                  type="button"
                  onClick={markAll}
                  disabled={pending}
                  className="text-xs text-muted underline underline-offset-4 hover:text-ink disabled:opacity-60"
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                Nothing here yet. Order updates and announcements appear here.
              </p>
            ) : (
              <ul className="max-h-96 divide-y divide-line overflow-y-auto">
                {items.map((item) => (
                  <li key={item.id} className={cn('px-4 py-3', !item.read && 'bg-sand/40')}>
                    <div className="flex gap-3">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="size-10 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span
                          className={cn(
                            'grid size-10 shrink-0 place-items-center rounded-md',
                            toneClass(item.tone),
                          )}
                          aria-hidden
                        >
                          <Icon name="bell" size={14} />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink">{item.title}</p>
                        {item.body ? (
                          <p className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-muted">
                            {item.body}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-muted">{relative(item.createdAt)}</p>

                        <div className="mt-1.5 flex gap-3 text-xs">
                          {item.link ? (
                            <a
                              href={item.link}
                              onClick={() => setOpen(false)}
                              className="underline underline-offset-4 hover:text-ink"
                            >
                              View
                            </a>
                          ) : null}
                          {!item.read ? (
                            <button
                              type="button"
                              onClick={() => markOne(item.id)}
                              disabled={pending}
                              className="text-muted underline underline-offset-4 hover:text-ink disabled:opacity-60"
                            >
                              Mark read
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}