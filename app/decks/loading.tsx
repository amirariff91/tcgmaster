import { Skeleton } from '@/components/ui/skeleton';

export default function DecksLoading() {
  return (
    <div aria-busy="true" aria-label="Loading decks" className="min-h-screen bg-[#060c18] pt-28 pb-20">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header Skeleton */}
        <div className="mb-12">
          <Skeleton className="h-4 w-32 bg-white/10 rounded-full mb-3" />
          <Skeleton className="h-10 w-72 bg-white/10 rounded-lg mb-3" />
          <Skeleton className="h-5 w-96 bg-white/5 rounded-md" />
        </div>

        {/* TCG Tabs Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-32 rounded-xl bg-white/10 shrink-0" />
          ))}
        </div>

        {/* Archetype Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-[#080e1e]/90 p-5 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-20 rounded-lg bg-white/10 shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <Skeleton className="h-5 w-3/4 bg-white/10" />
                  <Skeleton className="h-4 w-1/2 bg-white/5" />
                </div>
              </div>
              <Skeleton className="h-8 w-full rounded-lg bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
