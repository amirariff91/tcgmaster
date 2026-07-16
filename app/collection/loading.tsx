export default function CollectionLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your collection" className="min-h-screen bg-[#060c18] pt-24 pb-20">
      {/* Page header skeleton */}
      <div className="border-b border-white/10 bg-[#0b1329]/80 backdrop-blur-md px-4 py-8">
        <div className="container mx-auto flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-44 animate-pulse rounded-md bg-white/10" />
            <div className="h-4 w-64 animate-pulse rounded-md bg-white/5" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-md bg-white/10" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats row skeleton — 3 cols matching real page */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-[#0b1329]/80 backdrop-blur-sm p-4">
              <div className="mb-2 h-4 w-20 animate-pulse rounded-md bg-white/5" />
              <div className="h-7 w-24 animate-pulse rounded-md bg-white/10" />
            </div>
          ))}
        </div>

        {/* Tabs skeleton */}
        <div className="mb-6 flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-28 animate-pulse rounded-md bg-white/10" />
          ))}
        </div>

        {/* Card grid skeleton — max 3 cols matching real collection grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[5/7] w-full animate-pulse rounded-lg bg-white/5" />
              <div className="h-4 w-3/4 animate-pulse rounded-md bg-white/10" />
              <div className="h-4 w-1/2 animate-pulse rounded-md bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
