'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  disablePush,
  enablePush,
  getPushState,
  type PushState,
} from '@/lib/push/web-push';
import type { Dictionary } from '@/utils/translations';

function stateText(state: PushState, t: Dictionary): { label: string; hint: string } {
  const n = t.notifications;
  switch (state) {
    case 'on':
      return { label: n.pushStateOn, hint: n.pushHintOn };
    case 'off':
      return { label: n.pushStateOff, hint: n.pushHintOff };
    case 'ask':
      return { label: n.pushStateAsk, hint: n.pushHintAsk };
    case 'blocked':
      return { label: n.pushStateBlocked, hint: n.pushHintBlocked };
    case 'unsupported':
      return { label: n.pushStateUnsupported, hint: n.pushHintUnsupported };
    default:
      return { label: n.pushStateUnconfigured, hint: n.pushHintUnconfigured };
  }
}

/** Turn browser push on or off for this browser. */
export default function BrowserPushCard() {
  const { language, t } = useLanguage();
  const { showToast } = useApp();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState(await getPushState());
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const turnOn = async () => {
    setBusy(true);
    try {
      const next = await enablePush(language);
      setState(next);
      if (next === 'on') showToast(t.notifications.pushTurnedOn, 'success');
    } catch {
      showToast(t.notifications.pushFailed, 'error');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      await disablePush();
      showToast(t.notifications.pushTurnedOff, 'success');
    } catch {
      showToast(t.notifications.pushFailed, 'error');
    } finally {
      await load();
      setBusy(false);
    }
  };

  if (!state) return null;
  const { label, hint } = stateText(state, t);
  const tone =
    state === 'on'
      ? 'bg-emerald-50 text-emerald-700'
      : state === 'blocked'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-[#2D1F1F]/5 text-[#2D1F1F]/55';
  const buttonClass =
    'shrink-0 h-10 px-5 text-[10px] font-black tracking-[0.2em] uppercase rounded-md transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2';

  return (
    <div className="border border-[#2D1F1F]/8 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0 text-start">
        <span className="w-9 h-9 shrink-0 rounded-full bg-[#C9A84C]/12 text-[#C9A84C] flex items-center justify-center">
          <BellRing size={17} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#2D1F1F]">
            {t.notifications.pushTitle}
            <span className={`px-2.5 py-0.5 text-[10px] font-black tracking-[0.12em] uppercase rounded-md ${tone}`}>
              {label}
            </span>
          </p>
          <p className="text-sm text-[#2D1F1F]/50 mt-1 leading-relaxed">{hint}</p>
        </div>
      </div>
      {state === 'ask' || state === 'off' ? (
        <button
          type="button"
          onClick={() => void turnOn()}
          disabled={busy}
          className={`${buttonClass} bg-[#2D1F1F] text-white hover:bg-[#C9A84C]`}
        >
          {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
          {t.notifications.pushTurnOn}
        </button>
      ) : null}
      {state === 'on' ? (
        <button
          type="button"
          onClick={() => void turnOff()}
          disabled={busy}
          className={`${buttonClass} border border-[#2D1F1F]/15 text-[#2D1F1F] hover:border-[#C9A84C] hover:text-[#C9A84C]`}
        >
          {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
          {t.notifications.pushTurnOff}
        </button>
      ) : null}
    </div>
  );
}
