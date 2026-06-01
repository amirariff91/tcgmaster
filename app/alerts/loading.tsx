export default function AlertsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading alerts" className="min-h-screen">
      {/* Page header skeleton */}
      <div className="border-b border-zinc-200 bg-white px-4 py-6">
        <div className="container mx-auto flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-36 animate-pulse rounded-md bg-zinc-200" />
            <div className="h-4 w-56 animate-pulse rounded-md bg-zinc-100" />
          </div>
          <div className="h-9 w-28 animate-pulse rounded-md bg-zinc-200" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filter bar skeleton */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-9 w-40 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-9 w-36 animate-pulse rounded-md bg-zinc-200" />
        </div>

        {/* Alert list skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4"
            >
              {/* Card thumbnail */}
              <div className="h-16 w-11 flex-shrink-0 animate-pulse rounded-md bg-zinc-100" />

              {/* Alert info */}
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 animate-pulse rounded-md bg-zinc-200" />
                <div className="h-3 w-28 animate-pulse rounded-md bg-zinc-100" />
              </div>

              {/* Threshold & price */}
              <div className="hidden space-y-2 sm:block">
                <div className="h-4 w-20 animate-pulse rounded-md bg-zinc-200" />
                <div className="h-3 w-16 animate-pulse rounded-md bg-zinc-100" />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <div className="h-8 w-8 animate-pulse rounded-md bg-zinc-100" />
                <div className="h-8 w-8 animate-pulse rounded-md bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
