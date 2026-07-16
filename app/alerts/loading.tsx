export default function AlertsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading alerts" className="min-h-screen bg-[#060c18] pt-24 pb-20">
      {/* Page header skeleton */}
      <div className="border-b border-white/10 bg-[#0b1329]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-8">
          <div className="space-y-4">
            <div className="h-8 w-48 animate-pulse rounded-md bg-white/10" />
            <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-white/5" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filter bar skeleton — 3 pills */}
        <div className="mb-6 flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="h-9 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="h-9 w-24 animate-pulse rounded-full bg-white/10" />
        </div>

        {/* Alert list skeleton */}
        <div className="space-y-4 max-w-3xl">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-lg border border-white/10 bg-white/5 p-4"
            >
              {/* Card thumbnail */}
              <div className="h-16 w-11 flex-shrink-0 animate-pulse rounded-md bg-white/10" />

              {/* Alert info */}
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 animate-pulse rounded-md bg-white/5" />
              </div>

              {/* Threshold & price */}
              <div className="hidden space-y-2 sm:block">
                <div className="h-4 w-20 animate-pulse rounded-md bg-white/10" />
                <div className="h-3 w-16 animate-pulse rounded-md bg-white/5" />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <div className="h-8 w-8 animate-pulse rounded-md bg-white/5" />
                <div className="h-8 w-8 animate-pulse rounded-md bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
