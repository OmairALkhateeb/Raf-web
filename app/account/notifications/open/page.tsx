'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { markNotificationRead } from '@/lib/api/notifications';
import { notificationHref } from '@/lib/notifications/present';
import { loginHref } from '@/lib/auth/next-path';

const NOTIFICATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `/account/notifications/open?id=…&type=…&target_type=…&target_id=…&target_slug=…&variant=…`
 * Where the service worker sends a click on a push notification
 * (public/firebase-messaging-sw.js). Marks it read and opens the same screen
 * as the inbox row would.
 */
export default function NotificationOpenPage() {
  return (
    <Suspense fallback={<Opening />}>
      <OpenNotification />
    </Suspense>
  );
}

function Opening() {
  const { t } = useLanguage();
  return (
    <div className="max-w-[1440px] mx-auto px-6 py-32 text-center">
      <Loader2 size={20} className="animate-spin text-[#C9A84C] mx-auto" aria-hidden />
      <p className="text-sm text-[#2D1F1F]/40 mt-3">{t.notifications.opening}</p>
    </div>
  );
}

function OpenNotification() {
  const params = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const { refreshUnread } = useNotifications();
  const handled = useRef(false);

  useEffect(() => {
    if (isAuthLoading || handled.current) return;
    handled.current = true;

    if (!isAuthenticated) {
      // Back here after signing in, so the click still opens its screen.
      router.replace(loginHref(`${window.location.pathname}${window.location.search}`));
      return;
    }

    const targetType = params.get('target_type');
    const targetId = Number(params.get('target_id'));
    const href = notificationHref(
      targetType
        ? {
            type: targetType,
            id: Number.isInteger(targetId) && targetId > 0 ? targetId : null,
            slug: params.get('target_slug') || null,
          }
        : null,
      { type: params.get('type'), variant: params.get('variant') },
    );

    void (async () => {
      const id = params.get('id') ?? '';
      // Deleted or not ours: still open the screen.
      if (NOTIFICATION_ID.test(id)) await markNotificationRead(id);
      void refreshUnread();
      router.replace(href ?? '/account/notifications');
    })();
  }, [isAuthLoading, isAuthenticated, params, router, refreshUnread]);

  return <Opening />;
}
