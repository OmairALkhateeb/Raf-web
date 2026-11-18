export default function CmsLoading() {
  return (
    <div>
      <div className="border-b border-[#2D1F1F]/8 bg-white">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-10 sm:py-14">
          <div className="h-3 w-20 bg-[#EFECEA] rounded mb-3 animate-pulse" />
          <div className="h-10 w-64 max-w-full bg-[#EFECEA] rounded animate-pulse" />
          <div className="h-4 w-40 max-w-full bg-[#EFECEA] rounded mt-4 animate-pulse" />
        </div>
      </div>
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 py-10 sm:py-14">
        <div className="h-40 bg-[#EFECEA] rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
