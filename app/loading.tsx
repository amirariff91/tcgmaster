export default function RootLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="min-h-[60vh] w-full">
      {/* Hero / banner skeleton */}
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-8 w-56 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-zinc-100" />
          <div className="h-10 w-72 animate-pulse rounded-md bg-zinc-200" />
        </div>
      </div>

      {/* Card grid skeleton */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 h-6 w-32 animate-pulse rounded-md bg-zinc-200" />
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
