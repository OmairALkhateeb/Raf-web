'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  fetchUnreadCount,
  updateNotificationPreferences,
} from '@/lib/api/notifications';
import {
  readNotificationLocale,
  storeNotificationLocale,
} from '@/lib/push/storage';
import WebPushSync from '@/components/notifications/WebPushSync';
import type { NotificationUnread } from '@/types';

/** The bell also refreshes on focus and on every push; polling is the fallback. */
const POLL_MS = 60_000;

const EMPTY: NotificationUnread = { unreadCount: 0, byCategory: {} };

interface NotificationsContextValue {
  unread: NotificationUnread;
  refreshUnread: () => Promise<void>;
  /** A push brought a new count (`unread_count`), no request needed. */
  setUnreadCount: (count: number) => void;
  /** Bumped when a push arrives, so an open inbox reloads. */
  inboxVersion: number;
  bumpInbox: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(
  undefined,
);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const userId = user?.id ?? null;

  // Tagged with the user, so another account (or a guest) never sees this count.
  const [state, setState] = useState<{ userId: string; unread: NotificationUnread } | null>(
    null,
  );
  const [inboxVersion, setInboxVersion] = useState(0);
  const requestRef = useRef(0);

  const unread = userId && state?.userId === userId ? state.unread : EMPTY;

  const refreshUnread = useCallback(async () => {
    if (!userId) return;
    const request = ++requestRef.current;
    const result = await fetchUnreadCount();
    if (request !== requestRef.current || !result.ok) return;
    setState({ userId, unread: result.data });
  }, [userId]);

  const setUnreadCount = useCallback(
    (count: number) => {
      if (!userId) return;
      requestRef.current += 1; // a slower poll must not overwrite this
      setState((previous) => ({
        userId,
        unread: {
          unreadCount: Math.max(0, count),
          byCategory: previous?.userId === userId ? previous.unread.byCategory : {},
        },
      }));
    },
    [userId],
  );

  const bumpInbox = useCallback(() => setInboxVersion((v) => v + 1), []);

  // Unread count: now, every minute while the tab is visible, and on return to the tab.
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      await refreshUnread();
    })();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshUnread();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshUnread();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, refreshUnread]);

  // Language of e-mails and stored notifications: after login and on every switch.
  useEffect(() => {
    if (!userId) return;
    const key = `${userId}:${language}`;
    if (readNotificationLocale() === key) return;
    void (async () => {
      const result = await updateNotificationPreferences({ locale: language });
      if (result.ok) storeNotificationLocale(key);
    })();
  }, [userId, language]);

  const value = useMemo(
    () => ({ unread, refreshUnread, setUnreadCount, inboxVersion, bumpInbox }),
    [unread, refreshUnread, setUnreadCount, inboxVersion, bumpInbox],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <WebPushSync />
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
