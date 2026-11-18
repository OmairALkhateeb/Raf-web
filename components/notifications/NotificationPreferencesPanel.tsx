'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/api/notifications';
import { pickLocalized } from '@/lib/i18n/language';
import type { NotificationCategory, NotificationPreference } from '@/types';

type Channel = 'push' | 'mail';

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2 ${
        checked ? 'bg-[#C9A84C]' : 'bg-[#2D1F1F]/15'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px] rtl:-translate-x-[22px]' : 'translate-x-0.5 rtl:-translate-x-0.5'
        }`}
      />
    </button>
  );
}

/** Push / e-mail switches per category. The inbox itself can't be turned off. */
export default function NotificationPreferencesPanel({
  onUnauthenticated,
}: {
  onUnauthenticated: () => void;
}) {
  const { language, t } = useLanguage();
  const { showToast } = useApp();
  const [items, setItems] = useState<NotificationPreference[] | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    setError(false);
    const result = await fetchNotificationPreferences();
    if (!result.ok) {
      if (result.code === 'unauthenticated') {
        onUnauthenticated();
        return;
      }
      setError(true);
      return;
    }
    setItems(result.data.items);
  }, [onUnauthenticated]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const change = async (category: NotificationCategory, channel: Channel, next: boolean) => {
    if (savingRef.current || !items) return;
    savingRef.current = true;
    setSaving(`${category}:${channel}`);
    const before = items;
    setItems(items.map((row) => (row.category === category ? { ...row, [channel]: next } : row)));
    const result = await updateNotificationPreferences({
      preferences: { [category]: { [channel]: next } },
    });
    savingRef.current = false;
    setSaving(null);
    if (!result.ok) {
      setItems(before);
      if (result.code === 'unauthenticated') {
        onUnauthenticated();
        return;
      }
      showToast(t.notifications.actionFailed, 'error');
      return;
    }
    setItems(result.data.items);
    showToast(t.notifications.preferencesSaved, 'success');
  };

  if (error) {
    return (
      <div className="border border-[#2D1F1F]/8 rounded-xl px-6 py-12 text-center">
        <p className="text-sm text-[#2D1F1F]/55 mb-4" role="alert">
          {t.notifications.preferencesLoadError}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="text-[10px] font-black tracking-[0.2em] uppercase text-[#C9A84C] hover:text-[#2D1F1F]"
        >
          {t.common.retry}
        </button>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="border border-[#2D1F1F]/8 rounded-xl py-16 flex justify-center">
        <Loader2 size={22} className="animate-spin text-[#C9A84C]" aria-label={t.common.loading} />
      </div>
    );
  }

  return (
    <div className="border border-[#2D1F1F]/8 rounded-xl overflow-hidden">
      <div className="px-6 py-5 border-b border-[#2D1F1F]/8">
        <h2 className="text-sm font-bold text-[#2D1F1F]">{t.notifications.preferencesTitle}</h2>
        <p className="text-sm text-[#2D1F1F]/50 mt-1 leading-relaxed">
          {t.notifications.preferencesHint}
        </p>
      </div>
      <div className="hidden sm:grid grid-cols-[1fr_88px_88px] gap-4 px-6 py-3 bg-[#FAF7F2] text-[10px] font-black tracking-[0.15em] uppercase text-[#2D1F1F]/45">
        <span />
        <span className="text-center">{t.notifications.channelPush}</span>
        <span className="text-center">{t.notifications.channelMail}</span>
      </div>
      <ul className="divide-y divide-[#2D1F1F]/8">
        {items.map((row) => {
          const label = pickLocalized(language, row.label.en, row.label.ar);
          return (
            <li
              key={row.category}
              className="px-6 py-4 grid grid-cols-1 sm:grid-cols-[1fr_88px_88px] gap-3 sm:gap-4 sm:items-center"
            >
              <p className="text-sm font-medium text-[#2D1F1F] flex items-center gap-2">
                {label}
                {row.mandatory ? (
                  <span className="px-2 py-0.5 text-[9px] font-black tracking-[0.12em] uppercase rounded-md bg-[#2D1F1F]/5 text-[#2D1F1F]/50">
                    {t.notifications.mandatory}
                  </span>
                ) : null}
              </p>
              {(['push', 'mail'] as const).map((channel) => (
                <div
                  key={channel}
                  className="flex items-center justify-between sm:justify-center gap-3"
                >
                  <span className="sm:hidden text-xs text-[#2D1F1F]/50">
                    {channel === 'push' ? t.notifications.channelPush : t.notifications.channelMail}
                  </span>
                  <Toggle
                    checked={row[channel]}
                    disabled={row.mandatory || saving !== null}
                    label={`${label}: ${
                      channel === 'push' ? t.notifications.channelPush : t.notifications.channelMail
                    }`}
                    onChange={(next) => void change(row.category, channel, next)}
                  />
                </div>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
