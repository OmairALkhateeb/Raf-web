export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden animate-pulse">
      <div className="skeleton aspect-square w-full" />
      <div className="p-4 space-y-2">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="flex justify-between items-center pt-2">
          <div className="skeleton h-5 w-1/4 rounded" />
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton h-4 rounded ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function BannerSkeleton() {
  return <div className="skeleton w-full h-[500px] rounded-2xl" />;
}

export function ProductDetailSkeleton() {
  return (
    <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-10 sm:py-14">
      <div className="grid lg:grid-cols-[1fr_1fr] gap-10 lg:gap-16 xl:gap-24">
        <div className="space-y-3">
          <div className="skeleton w-full rounded-xl" style={{ aspectRatio: '4/5' }} />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton w-20 h-20 rounded-md" />
            ))}
          </div>
        </div>
        <div className="space-y-4 pt-2">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-9 w-3/4 rounded" />
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-8 w-32 rounded" />
          <div className="skeleton h-20 w-full rounded" />
          <div className="skeleton h-13 w-full rounded-md" style={{ height: 52 }} />
        </div>
      </div>
    </div>
  );
}
