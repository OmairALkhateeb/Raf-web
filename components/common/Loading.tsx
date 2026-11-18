import { Loader2 } from 'lucide-react';

/**
 * One way to show "loading" across the store:
 * - a page waiting for the sign-in or its data → a skeleton shaped like the
 *   page (AccountPageSkeleton, StorePageSkeleton);
 * - a list inside a card → ListSkeleton;
 * - a short wait without a known layout (checking a payment) → CenteredLoading;
 * - a small inline wait → Spinner (buttons keep their own colour: tone="inherit").
 * The shimmer is the `.skeleton` class in globals.css.
 */

const cx = 'max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16';

export function Spinner({
  size = 20,
  label,
  tone = 'gold',
  className = '',
}: {
  size?: number;
  /** Read out by screen readers; leave out when the text next to it says it. */
  label?: string;
  tone?: 'gold' | 'inherit';
  className?: string;
}) {
  return (
    <Loader2
      size={size}
      className={`animate-spin ${tone === 'gold' ? 'text-[#C9A84C]' : ''} ${className}`}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded ${className}`} />;
}

/** Wraps a skeleton: one "busy" region with a name, the shapes are hidden. */
function Busy({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      {label ? <span className="sr-only">{label}</span> : null}
      {children}
    </div>
  );
}

/** The white band with the small eyebrow and the big title that inner pages start with. */
function HeaderBandSkeleton() {
  return (
    <div className="border-b border-[#2D1F1F]/8 bg-white">
      <div className={`${cx} py-10 sm:py-14`}>
        <SkeletonBlock className="h-3 w-24 mb-4" />
        <SkeletonBlock className="h-9 w-56 max-w-full" />
      </div>
    </div>
  );
}

function CardSkeleton({ lines = 4, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`border border-[#2D1F1F]/8 rounded-xl p-6 sm:p-8 bg-white/60 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <SkeletonBlock className="h-11 w-11 rounded-md flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <SkeletonBlock className="h-4 w-40 max-w-full" />
          <SkeletonBlock className="h-3 w-64 max-w-full" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}

/**
 * Account pages: the title band, the menu (chips on phones, the side card on
 * desktop) and a content card, in the same places as the real page.
 */
export function AccountPageSkeleton({ label }: { label?: string }) {
  return (
    <Busy label={label}>
      <HeaderBandSkeleton />
      <div className={`${cx} py-14 sm:py-20`}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10">
          <div className="lg:hidden -mx-6 sm:-mx-10 px-6 sm:px-10 flex gap-2 overflow-hidden">
            {['w-24', 'w-28', 'w-24', 'w-32'].map((width, i) => (
              <SkeletonBlock key={i} className={`h-10 rounded-full flex-shrink-0 ${width}`} />
            ))}
          </div>
          <div className="hidden lg:block space-y-5">
            <div className="border border-[#2D1F1F]/8 rounded-xl p-8 flex flex-col items-center gap-3">
              <SkeletonBlock className="h-20 w-20 rounded-full" />
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-3 w-44" />
            </div>
            <div className="border border-[#2D1F1F]/8 rounded-xl p-5 space-y-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
          <div className="space-y-6 min-w-0">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={3} className="hidden sm:block" />
          </div>
        </div>
      </div>
    </Busy>
  );
}

/** Cart, checkout, returns: the title band and a main column with a side card. */
export function StorePageSkeleton({ label }: { label?: string }) {
  return (
    <Busy label={label}>
      <HeaderBandSkeleton />
      <div className={`${cx} py-10 sm:py-14`}>
        <div className="grid lg:grid-cols-[1fr_400px] gap-10 lg:gap-16">
          <div className="space-y-4">
            <ListSkeleton rows={3} />
          </div>
          <CardSkeleton lines={5} />
        </div>
      </div>
    </Busy>
  );
}

/**
 * Rows of a list (orders, returns, notifications…). `bare`: inside a card
 * that already has its own border.
 */
export function ListSkeleton({
  rows = 3,
  label,
  bare = false,
}: {
  rows?: number;
  label?: string;
  bare?: boolean;
}) {
  return (
    <Busy label={label}>
      <ul
        className={`divide-y divide-[#2D1F1F]/8 ${
          bare ? '' : 'border border-[#2D1F1F]/8 rounded-xl overflow-hidden bg-white/60'
        }`}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center gap-4 px-6 py-5">
            <SkeletonBlock className="h-14 w-14 rounded-md flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <SkeletonBlock className="h-4 w-1/2" />
              <SkeletonBlock className="h-3 w-1/3" />
            </div>
            <SkeletonBlock className="h-6 w-16 rounded-md flex-shrink-0" />
          </li>
        ))}
      </ul>
    </Busy>
  );
}

/** A short wait without a known layout: the spinner and one line of text. */
export function CenteredLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className={`${cx} py-28 flex flex-col items-center gap-3 text-center`}>
      <Spinner size={22} />
      <p className="text-sm text-[#2D1F1F]/45">{label}</p>
    </div>
  );
}
