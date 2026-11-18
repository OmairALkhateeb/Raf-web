'use client';

import { WifiOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Shown while the sign-in check can't reach the server. The visitor stays
 * signed in; the check runs again by itself, or now with "Try again".
 */
export default function ConnectionNotice({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-20 lg:bottom-6 z-[70] mx-auto max-w-md rounded-lg bg-[#2D1F1F] px-4 py-3 text-white shadow-lg flex items-center gap-3"
    >
      <WifiOff size={16} className="flex-shrink-0 text-[#C9A84C]" aria-hidden />
      <p className="flex-1 text-xs leading-relaxed text-start">{t.common.connectionRetrying}</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex-shrink-0 text-[10px] font-black tracking-[0.15em] uppercase text-[#C9A84C] hover:text-white transition-colors"
      >
        {t.common.retry}
      </button>
    </div>
  );
}
