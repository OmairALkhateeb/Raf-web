'use client';

import { useState } from 'react';
import { ExternalLink, Loader2, LocateFixed, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  isInsideOman,
  roundCoordinate,
  type AddressLocation,
} from '@/lib/account/location';

type LocateError = 'denied' | 'unavailable' | 'outside';

export function mapsHref(location: AddressLocation): string {
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

/**
 * Optional delivery pin (Laravel `latitude` / `longitude`). The browser
 * location is read only when the customer taps the button.
 */
export default function AddressLocationPicker({
  value,
  onChange,
  disabled,
}: {
  value: AddressLocation | null;
  onChange: (next: AddressLocation | null) => void;
  disabled: boolean;
}) {
  const { t } = useLanguage();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<LocateError | null>(null);

  const locate = () => {
    if (locating || disabled) return;
    setError(null);
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setError('unavailable');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const next = {
          latitude: roundCoordinate(position.coords.latitude),
          longitude: roundCoordinate(position.coords.longitude),
        };
        // Delivery is Oman-only: a pin elsewhere would only mislead the courier.
        if (!isInsideOman(next)) {
          setError('outside');
          return;
        }
        onChange(next);
      },
      (failure) => {
        setLocating(false);
        setError(failure.code === failure.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const errorText =
    error === 'denied'
      ? t.account.locationDenied
      : error === 'outside'
        ? t.account.locationOutsideOman
        : error === 'unavailable'
          ? t.account.locationUnavailable
          : null;

  const delta = 0.004;
  const embed = value
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${value.longitude - delta}%2C${
        value.latitude - delta
      }%2C${value.longitude + delta}%2C${value.latitude + delta}&layer=mapnik&marker=${
        value.latitude
      }%2C${value.longitude}`
    : null;

  return (
    <div>
      <p className="block text-[10px] font-black tracking-[0.2em] uppercase text-[#2D1F1F]/45 mb-2">
        {t.account.locationTitle}
      </p>
      <p className="text-xs text-[#2D1F1F]/50 mb-3 leading-relaxed">{t.account.locationHint}</p>

      {value && embed ? (
        <div className="border border-[#2D1F1F]/12 rounded-md overflow-hidden">
          <iframe
            src={embed}
            title={t.account.locationMapTitle}
            className="w-full h-44 border-0 block"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#FAF7F2]">
            <span className="text-xs text-[#2D1F1F]/60" dir="ltr">
              {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            </span>
            <span className="flex items-center gap-3">
              <a
                href={mapsHref(value)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-black tracking-[0.15em] uppercase text-[#C9A84C] hover:text-[#2D1F1F]"
              >
                {t.account.locationOpenMap}
                <ExternalLink size={11} aria-hidden />
              </a>
              <button
                type="button"
                onClick={locate}
                disabled={disabled || locating}
                className="text-[10px] font-black tracking-[0.15em] uppercase text-[#2D1F1F]/60 hover:text-[#2D1F1F] disabled:opacity-40"
              >
                {t.account.locationUpdate}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  onChange(null);
                }}
                disabled={disabled}
                className="inline-flex items-center gap-1 text-[10px] font-black tracking-[0.15em] uppercase text-red-500 hover:text-red-700 disabled:opacity-40"
              >
                <X size={11} aria-hidden />
                {t.account.locationRemove}
              </button>
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={locate}
          disabled={disabled || locating}
          className="w-full h-11 px-4 border border-dashed border-[#2D1F1F]/25 text-sm text-[#2D1F1F]/70 rounded-md hover:border-[#C9A84C] hover:text-[#2D1F1F] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {locating ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : (
            <LocateFixed size={15} className="text-[#C9A84C]" aria-hidden />
          )}
          {locating ? t.account.locating : t.account.useMyLocation}
        </button>
      )}
      {locating && value ? (
        <p className="text-xs text-[#2D1F1F]/50 mt-2">{t.account.locating}</p>
      ) : null}
      {errorText ? (
        <p className="text-xs text-red-500 mt-2" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
