'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bell,
  Loader2,
  Megaphone,
  MessageCircle,
  Package,
  RotateCcw,
  Trash2,
  Truck,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import AccountSidebar from '@/components/account/AccountSidebar';
import BrowserPushCard from '@/components/notifications/BrowserPushCard';
import NotificationPreferencesPanel from '@/components/notifications/NotificationPreferencesPanel';
import {
  deleteNotification,
  deleteReadNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notifications';
import {
  categoryLabel,
  NOTIFICATION_TABS,
  notificationHref,
  notificationTone,
  notificationText,
  notificationTime,
  unreadBadge,
} from '@/lib/notifications/present';
import type { CustomerNotification, NotificationCategory } from '@/types';
import { AccountPageSkeleton, ListSkeleton } from '@/components/common/Loading';

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

const CATEGORY_ICON: Record<NotificationCategory, typeof Bell> = {
  orders: Package,
  shipping: Truck,
  returns: RotateCcw,
  community: MessageCircle,
  announcements: Megaphone,
  other: Bell,
};

type Tab = NotificationCategory | 'all';

export default function AccountNotificationsPage() {
  return (
    <Suspense fallback={<NotificationsLoadingFallback />}>
      <AccountNotificationsContent />
    </Suspense>
  );
}

function NotificationsLoadingFallback() {
  const { t } = useLanguage();
  return <AccountPageSkeleton label={t.common.loading} />;
}

function AccountNotificationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, isRTL } = useLanguage();
  const { showToast } = useApp();
  const { user, isAuthenticated, isAuthLoading, logout } = useAuth();

  const view = searchParams.get('view') === 'settings' ? 'settings' : 'inbox';

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthLoading, isAuthenticated, router]);

  const handleAuthFailure = useCallback(async () => {
    await logout();
    router.replace('/login');
  }, [logout, router]);

  const onUnauthenticated = useCallback(() => {
    void handleAuthFailure();
  }, [handleAuthFailure]);

  const handleLogout = async () => {
    await logout();
    showToast(t.common.signedOut, 'success');
    router.push('/');
  };

  if (isAuthLoading || !isAuthenticated || !user) {
    return <AccountPageSkeleton label={t.common.loading} />;
  }

  const viewTab = (target: 'inbox' | 'settings', label: string) => (
    <Link
      href={target === 'settings' ? '/account/notifications?view=settings' : '/account/notifications'}
      replace
      aria-current={view === target ? 'page' : undefined}
      className={`pb-3 text-[11px] font-black tracking-[0.2em] uppercase border-b-2 transition-colors ${
        view === target
          ? 'border-[#C9A84C] text-[#2D1F1F]'
          : 'border-transparent text-[#2D1F1F]/40 hover:text-[#2D1F1F]'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className={`${cx} py-10 sm:py-14`}>
          <span className="block text-[10px] font-black tracking-[0.4em] uppercase text-[#C9A84C] mb-3">
            {t.account.title}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#2D1F1F]">
            {t.notifications.title}
          </h1>
        </div>
      </div>

      <div className={`${cx} py-14 sm:py-20`}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10">
          <AccountSidebar user={user} onLogout={() => void handleLogout()} />

          <div className="space-y-6 min-w-0">
            <nav className="flex gap-6 border-b border-[#2D1F1F]/8">
              {viewTab('inbox', t.notifications.inboxTab)}
              {viewTab('settings', t.notifications.settingsTab)}
            </nav>

            {view === 'settings' ? (
              <>
                <BrowserPushCard />
                <NotificationPreferencesPanel onUnauthenticated={onUnauthenticated} />
              </>
            ) : (
              <NotificationsInbox onUnauthenticated={onUnauthenticated} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationsInbox({ onUnauthenticated }: { onUnauthenticated: () => void }) {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { showToast } = useApp();
  const { unread, refreshUnread, inboxVersion } = useNotifications();

  const [tab, setTab] = useState<Tab>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [now, setNow] = useState(0);
  const epochRef = useRef(0);

  const load = useCallback(
    async (nextPage: number) => {
      const epoch = nextPage === 1 ? ++epochRef.current : epochRef.current;
      if (nextPage === 1) {
        setLoading(true);
        setError(false);
      } else {
        setLoadingMore(true);
      }
      const result = await fetchNotifications({
        page: nextPage,
        unreadOnly,
        category: tab === 'all' ? null : tab,
      });
      if (epoch !== epochRef.current) return;
      setLoading(false);
      setLoadingMore(false);
      if (!result.ok) {
        if (result.code === 'unauthenticated') {
          onUnauthenticated();
          return;
        }
        if (nextPage === 1) {
          setItems([]);
          setError(true);
        } else {
          showToast(t.notifications.loadError, 'error');
        }
        return;
      }
      setNow(Date.now());
      setPage(result.data.currentPage);
      setLastPage(result.data.lastPage);
      setItems((previous) => {
        if (nextPage === 1) return result.data.notifications;
        const seen = new Set(previous.map((n) => n.id));
        return [...previous, ...result.data.notifications.filter((n) => !seen.has(n.id))];
      });
    },
    [tab, unreadOnly, onUnauthenticated, showToast, t],
  );

  // First page on tab / filter change and whenever a push arrives.
  useEffect(() => {
    void (async () => {
      await load(1);
    })();
  }, [load, inboxVersion]);

  const failed = (code: string) => {
    if (code === 'unauthenticated') {
      onUnauthenticated();
      return;
    }
    showToast(code === 'not_found' ? t.notifications.notFound : t.notifications.actionFailed, 'error');
  };

  const open = async (notification: CustomerNotification) => {
    if (busy) return;
    const href = notificationHref(notification.target, notification);
    if (!notification.isRead) {
      setBusy(notification.id);
      const result = await markNotificationRead(notification.id);
      setBusy(null);
      if (!result.ok) {
        if (result.code === 'not_found') {
          setItems((previous) => previous.filter((n) => n.id !== notification.id));
          void refreshUnread();
        }
        failed(result.code);
        return;
      }
      setItems((previous) =>
        unreadOnly
          ? previous.filter((n) => n.id !== notification.id)
          : previous.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
      );
      void refreshUnread();
    }
    if (href) router.push(href);
  };

  const remove = async (notification: CustomerNotification) => {
    if (busy) return;
    setBusy(notification.id);
    const result = await deleteNotification(notification.id);
    setBusy(null);
    if (!result.ok && result.code !== 'not_found') {
      failed(result.code);
      return;
    }
    setItems((previous) => previous.filter((n) => n.id !== notification.id));
    void refreshUnread();
    showToast(t.notifications.deleted, 'success');
  };

  const markAll = async () => {
    if (busy) return;
    setBusy('mark-all');
    const result = await markAllNotificationsRead(tab === 'all' ? null : tab);
    setBusy(null);
    if (!result.ok) {
      failed(result.code);
      return;
    }
    await refreshUnread();
    await load(1);
    showToast(t.notifications.markedAllRead, 'success');
  };

  const clearRead = async () => {
    if (busy) return;
    setBusy('clear-read');
    const result = await deleteReadNotifications();
    setBusy(null);
    setConfirmClear(false);
    if (!result.ok) {
      failed(result.code);
      return;
    }
    await load(1);
    showToast(t.notifications.deletedRead, 'success');
  };

  const tabCount = (value: Tab) =>
    value === 'all' ? unread.unreadCount : unread.byCategory[value] ?? 0;
  const tabUnread = tabCount(tab);

  const actionClass =
    'h-9 px-4 text-[10px] font-black tracking-[0.15em] uppercase rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
        {(['all', ...NOTIFICATION_TABS] as Tab[]).map((value) => {
          const count = tabCount(value);
          const active = tab === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(value)}
              className={`shrink-0 inline-flex items-center gap-2 h-9 px-4 rounded-full border text-xs font-semibold transition-colors ${
                active
                  ? 'bg-[#2D1F1F] border-[#2D1F1F] text-white'
                  : 'border-[#2D1F1F]/12 text-[#2D1F1F]/65 hover:border-[#C9A84C]'
              }`}
            >
              {value === 'all' ? t.notifications.tabAll : categoryLabel(value, t)}
              {count > 0 ? (
                <span
                  className={`min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                    active ? 'bg-[#C9A84C] text-white' : 'bg-[#C9A84C]/15 text-[#9A7B2C]'
                  }`}
                >
                  {unreadBadge(count)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-[#2D1F1F]/70 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => setUnreadOnly(event.target.checked)}
            className="h-4 w-4 accent-[#C9A84C]"
          />
          {t.notifications.unreadOnly}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void markAll()}
            disabled={busy !== null || tabUnread === 0}
            className={`${actionClass} border border-[#2D1F1F]/15 text-[#2D1F1F] hover:border-[#C9A84C] hover:text-[#C9A84C]`}
          >
            {t.notifications.markAllRead}
          </button>
          {confirmClear ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-xs text-[#2D1F1F]/60">{t.notifications.deleteReadConfirm}</span>
              <button
                type="button"
                onClick={() => void clearRead()}
                disabled={busy !== null}
                className={`${actionClass} bg-red-600 text-white hover:bg-red-700`}
              >
                {busy === 'clear-read' ? (
                  <Loader2 size={12} className="animate-spin" aria-label={t.common.loading} />
                ) : (
                  t.notifications.delete
                )}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className={`${actionClass} text-[#2D1F1F]/55 hover:text-[#2D1F1F]`}
              >
                {t.account.cancel}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={busy !== null}
              className={`${actionClass} border border-[#2D1F1F]/15 text-[#2D1F1F]/70 hover:border-red-300 hover:text-red-600`}
            >
              {t.notifications.deleteRead}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={4} label={t.common.loading} />
      ) : error ? (
        <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-12 text-center">
          <p className="text-sm text-[#2D1F1F]/55 mb-4" role="alert">
            {t.notifications.loadError}
          </p>
          <button
            type="button"
            onClick={() => void load(1)}
            className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F]"
          >
            {t.common.retry}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-16 text-center">
          <Bell size={32} strokeWidth={1} className="text-[#2D1F1F]/15 mx-auto mb-4" />
          <p className="text-sm text-[#2D1F1F]/40">
            {unreadOnly ? t.notifications.emptyUnread : t.notifications.empty}
          </p>
        </div>
      ) : (
        <>
          <ul className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden divide-y divide-[#2D1F1F]/8">
            {items.map((notification) => {
              const { title, body } = notificationText(notification, language, t);
              const Icon = CATEGORY_ICON[notification.category];
              const href = notificationHref(notification.target, notification);
              const clickable = Boolean(href) || !notification.isRead;
              const rowBusy = busy === notification.id;
              const tone = notificationTone(notification);
              return (
                <li
                  key={notification.id}
                  className={`relative flex gap-3 px-4 sm:px-6 py-4 ${
                    notification.isRead ? 'bg-white' : 'bg-[#C9A84C]/[0.06]'
                  }`}
                >
                  <span
                    className={`mt-0.5 w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${
                      tone === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : tone === 'attention'
                          ? 'bg-amber-50 text-amber-700'
                          : notification.isRead
                            ? 'bg-[#2D1F1F]/5 text-[#2D1F1F]/45'
                            : 'bg-[#C9A84C]/15 text-[#9A7B2C]'
                    }`}
                  >
                    <Icon size={16} aria-hidden />
                  </span>
                  <button
                    type="button"
                    onClick={() => void open(notification)}
                    disabled={!clickable || rowBusy}
                    className="flex-1 min-w-0 text-start disabled:cursor-default focus-visible:outline-none focus-visible:underline"
                  >
                    <span className="flex items-start gap-2">
                      <span
                        className={`text-sm leading-snug ${
                          notification.isRead
                            ? 'font-medium text-[#2D1F1F]/75'
                            : 'font-bold text-[#2D1F1F]'
                        }`}
                      >
                        {title}
                      </span>
                      {notification.isRead ? null : (
                        <span
                          className="mt-1.5 w-2 h-2 rounded-full bg-[#C9A84C] shrink-0"
                          aria-label={t.notifications.unreadLabel}
                        />
                      )}
                    </span>
                    {body ? (
                      <span className="block text-sm text-[#2D1F1F]/55 mt-1 leading-relaxed break-words">
                        {body}
                      </span>
                    ) : null}
                    <span className="block text-[11px] text-[#2D1F1F]/40 mt-1.5">
                      {categoryLabel(notification.category, t)} ·{' '}
                      {notificationTime(notification.createdAt, now, language, t)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(notification)}
                    disabled={busy !== null}
                    aria-label={`${t.notifications.delete}: ${title}`}
                    className="self-start p-2 -m-1 text-[#2D1F1F]/30 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    {rowBusy ? (
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                    ) : (
                      <Trash2 size={15} aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {page < lastPage ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void load(page + 1)}
                disabled={loadingMore}
                className="h-11 px-6 border border-[#2D1F1F]/15 text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F] rounded-md hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {loadingMore ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
                {t.notifications.loadMore}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
