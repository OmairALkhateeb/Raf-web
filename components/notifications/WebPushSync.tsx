'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { MessagePayload } from 'firebase/messaging';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import {
  canAutoRegister,
  isPushConfigured,
  PUSH_OPEN_MESSAGE,
  registerPushDevice,
  subscribeToForegroundPush,
} from '@/lib/push/web-push';

/**
 * Browser push for a signed-in customer. Does nothing until the Firebase keys
 * are in .env.local.
 * - keeps this browser registered (login, start, language change) if the customer allowed it
 * - foreground messages: badge from `unread_count`, reload an open inbox, toast
 * - clicks on system notifications while a tab is open (sent by the service worker)
 */
export default function WebPushSync() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { showToast } = useApp();
  const { setUnreadCount, refreshUnread, bumpInbox } = useNotifications();
  const router = useRouter();
  // A message can arrive twice (several tabs, retries): handle each notification once.
  const seenRef = useRef(new Set<string>());

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId || !canAutoRegister()) return;
    // On failure the bell keeps polling.
    registerPushDevice(language).catch(() => undefined);
  }, [userId, language]);

  useEffect(() => {
    if (!userId || !isPushConfigured()) return;

    const onPush = (payload: MessagePayload) => {
      const data = payload.data ?? {};
      const id = data.notification_id;
      if (id) {
        if (seenRef.current.has(id)) return;
        seenRef.current.add(id);
      }
      const count = Number(data.unread_count);
      if (data.unread_count && Number.isFinite(count)) setUnreadCount(count);
      void refreshUnread(); // per-category counts
      bumpInbox();
      if (document.visibilityState === 'visible') {
        showToast(payload.notification?.title || t.notifications.pushNew, 'info');
      }
    };

    let unsubscribe: () => void = () => undefined;
    let active = true;
    void subscribeToForegroundPush(onPush).then((stop) => {
      if (active) unsubscribe = stop;
      else stop();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, setUnreadCount, refreshUnread, bumpInbox, showToast, t]);

  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const message = event.data as { type?: unknown; url?: unknown } | null;
      if (
        message?.type === PUSH_OPEN_MESSAGE &&
        typeof message.url === 'string' &&
        message.url.startsWith('/') &&
        !message.url.startsWith('//')
      ) {
        router.push(message.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    navigator.serviceWorker.startMessages();
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [userId, router]);

  return null;
}
