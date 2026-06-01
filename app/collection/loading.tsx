export default function CollectionLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your collection" className="min-h-screen">
      {/* Page header skeleton */}
      <div className="border-b border-zinc-200 bg-white px-4 py-6">
        <div className="container mx-auto flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-44 animate-pulse rounded-md bg-zinc-200" />
            <div className="h-4 w-64 animate-pulse rounded-md bg-zinc-100" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-md bg-zinc-200" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats row skeleton */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 h-4 w-20 animate-pulse rounded-md bg-zinc-100" />
              <div className="h-7 w-24 animate-pulse rounded-md bg-zinc-200" />
            </div>
          ))}
        </div>

        {/* Tabs skeleton */}
        <div className="mb-6 flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-28 animate-pulse rounded-md bg-zinc-200" />
          ))}
        </div>

        {/* Card grid skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[5/7] w-full animate-pulse rounded-lg bg-zinc-100" />
              <div className="h-4 w-3/4 animate-pulse rounded-md bg-zinc-200" />
              <div className="h-4 w-1/2 animate-pulse rounded-md bg-zinc-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
