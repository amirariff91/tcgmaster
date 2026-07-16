export default function SearchLoading() {
  return (
    <div aria-busy="true" aria-label="Loading search results" className="min-h-screen bg-[#060c18] pt-24 pb-20">
      {/* Search bar header skeleton */}
      <div className="border-b border-white/10 bg-[#0b1329]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-6">
          <div className="mx-auto max-w-2xl">
            <div className="h-10 w-full animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Results header skeleton */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 animate-pulse rounded-md bg-white/10" />
            <div className="h-4 w-24 animate-pulse rounded-md bg-white/5" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-44 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>

        {/* Card grid skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
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
