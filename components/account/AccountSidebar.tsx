'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  Package,
  Heart,
  MapPin,
  Settings,
  LogOut,
  ChevronRight,
  Star,
  MessageCircleQuestion,
  Boxes,
  Bell,
  Undo2,
  Landmark,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { REFUND_ACCOUNT_HREF } from '@/lib/account/refund-account';
import type { User as StoreUser } from '@/types';

interface AccountSidebarProps {
  user: StoreUser;
  orderTotal?: number | null;
  onLogout: () => void;
}

type NavMatch =
  | 'profile'
  | 'orders'
  | 'returns'
  | 'notifications'
  | 'reviews'
  | 'questions'
  | 'bulk'
  | 'wishlist'
  | 'addresses'
  | 'bank'
  | 'settings';

function isActive(match: NavMatch, pathname: string): boolean {
  switch (match) {
    case 'settings':
      return pathname === '/account/settings';
    case 'profile':
      return pathname === '/account/profile';
    case 'wishlist':
      return pathname === '/wishlist';
    case 'orders':
      return pathname === '/account' || pathname.startsWith('/account/orders/');
    case 'reviews':
      return pathname === '/account/reviews';
    case 'questions':
      return pathname === '/account/product-questions';
    case 'bulk':
      return pathname === '/account/bulk-orders';
    case 'notifications':
      return pathname.startsWith('/account/notifications');
    case 'returns':
      return pathname === '/returns';
    default:
      return false;
  }
}

export default function AccountSidebar({
  user,
  orderTotal,
  onLogout,
}: AccountSidebarProps) {
  const { t, isRTL } = useLanguage();
  const pathname = usePathname();
  const { unread } = useNotifications();
  const chipsRef = useRef<HTMLUListElement>(null);

  const navItems: Array<{
    href: string;
    label: string;
    icon: typeof User;
    match: NavMatch;
    badge?: number | null;
  }> = [
    { href: '/account/profile', label: t.account.profile, icon: User, match: 'profile' },
    { href: '/account', label: t.account.orders, icon: Package, badge: orderTotal, match: 'orders' },
    { href: '/returns', label: t.account.myReturns, icon: Undo2, match: 'returns' },
    {
      href: '/account/notifications',
      label: t.notifications.title,
      icon: Bell,
      badge: unread.unreadCount > 0 ? unread.unreadCount : null,
      match: 'notifications',
    },
    { href: '/account/reviews', label: t.account.myReviews, icon: Star, match: 'reviews' },
    {
      href: '/account/product-questions',
      label: t.account.myQuestions,
      icon: MessageCircleQuestion,
      match: 'questions',
    },
    { href: '/account/bulk-orders', label: t.account.myBulkOrders, icon: Boxes, match: 'bulk' },
    { href: '/wishlist', label: t.account.wishlist, icon: Heart, match: 'wishlist' },
    { href: '/account', label: t.account.addresses, icon: MapPin, match: 'addresses' },
    // The "Bank account for refunds" card on Profile (guide §9.2).
    { href: REFUND_ACCOUNT_HREF, label: t.account.bankAccountMenu, icon: Landmark, match: 'bank' },
    { href: '/account/settings', label: t.account.settings, icon: Settings, match: 'settings' },
  ];

  // Phones: bring the current page's chip into view (the row scrolls sideways).
  useEffect(() => {
    const row = chipsRef.current;
    const active = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !active) return;
    const rowBox = row.getBoundingClientRect();
    const chipBox = active.getBoundingClientRect();
    row.scrollLeft += chipBox.left - rowBox.left - (rowBox.width - chipBox.width) / 2;
  }, [pathname]);

  const initial = user.name.trim().charAt(0).toUpperCase() || 'R';

  return (
    <>
      {/* Phones and tablets: one scrollable row, so the page itself comes
          first instead of a tall menu. `min-w-0`: the row scrolls inside
          itself instead of widening the page's grid column. */}
      <nav aria-label={t.account.title} className="lg:hidden min-w-0 -mx-6 sm:-mx-10">
        <ul
          ref={chipsRef}
          className="hide-scrollbar flex gap-2 overflow-x-auto px-6 sm:px-10 pb-1"
        >
          {navItems.map((item) => {
            const active = isActive(item.match, pathname);
            return (
              <li key={`${item.href}-${item.match}`} className="flex-shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]/50 ${
                    active
                      ? 'border-[#2D1F1F] bg-[#2D1F1F] text-white'
                      : 'border-[#2D1F1F]/12 bg-white text-[#2D1F1F] hover:border-[#C9A84C]'
                  }`}
                >
                  <item.icon size={14} className="text-[#C9A84C]" aria-hidden />
                  {item.label}
                  {item.badge != null ? (
                    <span className="min-w-[18px] h-[18px] bg-[#C9A84C] text-white text-[9px] font-black flex items-center justify-center px-1 rounded-md">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
          <li className="flex-shrink-0">
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-red-200 bg-white px-4 text-xs font-semibold whitespace-nowrap text-red-500 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              <LogOut size={14} aria-hidden />
              {t.account.logout}
            </button>
          </li>
        </ul>
      </nav>

      <div className="hidden lg:block space-y-5">
        <div className="border border-[#2D1F1F]/8 rounded-xl p-8 text-center">
          <div className="relative w-20 h-20 overflow-hidden mx-auto mb-4 ring-2 ring-[#C9A84C] ring-offset-2 rounded-full bg-[#FAF7F2] flex items-center justify-center">
            {user.avatar ? (
              <Image
                src={user.avatar}
                alt={user.name}
                fill
                className="object-cover"
                sizes="80px"
              />
            ) : (
              <span className="font-serif text-2xl text-[#2D1F1F]">
                {initial}
              </span>
            )}
          </div>
          <h2 className="text-base font-semibold text-[#2D1F1F]">{user.name}</h2>
          <p className="text-xs text-[#2D1F1F]/45 mt-1 break-all" dir="ltr">{user.email}</p>
          {user.phone ? (
            <p className="text-xs text-[#2D1F1F]/45 mt-1" dir="ltr">{user.phone}</p>
          ) : null}
        </div>

        <nav aria-label={t.account.title} className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden">
          {navItems.map((item, i) => {
            const active = isActive(item.match, pathname);
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center justify-between px-5 py-3.5 hover:bg-[#FAF7F2] transition-colors focus-visible:outline-none focus-visible:bg-[#FAF7F2] ${
                  i < navItems.length - 1 ? 'border-b border-[#2D1F1F]/8' : ''
                } ${active ? 'bg-[#FAF7F2]' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={15} className="text-[#C9A84C]" />
                  <span className="text-sm font-medium text-[#2D1F1F]">
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.badge != null && (
                    <span className="min-w-[18px] h-[18px] bg-[#C9A84C] text-white text-[9px] font-black flex items-center justify-center px-1 rounded-md">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight
                    size={12}
                    className={`text-[#2D1F1F]/25 ${isRTL ? 'rtl-flip' : ''}`}
                  />
                </div>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-5 py-3.5 text-sm text-red-400 hover:bg-red-50 transition-colors border-t border-[#2D1F1F]/8 focus-visible:outline-none focus-visible:bg-red-50"
          >
            <LogOut size={15} />
            {t.account.logout}
          </button>
        </nav>
      </div>
    </>
  );
}
