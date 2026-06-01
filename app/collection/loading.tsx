export default function CollectionLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your collection" className="min-h-screen">
      {/* Page header skeleton */}
      <div className="border-b border-zinc-200 bg-white px-4 py-6">
        <div className="container mx-auto flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-44 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-4 w-64 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats row skeleton — 3 cols matching real page */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="mb-2 h-4 w-20 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-7 w-24 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
            </div>
          ))}
        </div>

        {/* Tabs skeleton */}
        <div className="mb-6 flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-28 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
          ))}
        </div>

        {/* Card grid skeleton — max 3 cols matching real collection grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-[5/7] w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-4 w-3/4 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-4 w-1/2 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
