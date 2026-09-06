import { Skeleton } from '@/components/ui/skeleton';

export default function ArtistsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading artists" className="min-h-screen bg-[#060c18] pt-28 pb-20">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header Skeleton */}
        <div className="mb-12">
          <Skeleton className="h-4 w-32 bg-white/10 rounded-full mb-3" />
          <Skeleton className="h-10 w-80 bg-white/10 rounded-lg mb-3" />
          <Skeleton className="h-5 w-96 bg-white/5 rounded-md" />
        </div>

        {/* TCG Category Section Skeletons */}
        <div className="space-y-12">
          {Array.from({ length: 2 }).map((_, sectionIdx) => (
            <div key={sectionIdx} className="space-y-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-44 rounded-lg bg-white/10" />
                <Skeleton className="h-5 w-20 rounded-full bg-white/5" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-[#080e1e]/90 p-4 flex flex-col items-center space-y-3">
                    <Skeleton className="w-16 h-16 rounded-full bg-white/10" />
                    <Skeleton className="h-4 w-24 bg-white/10" />
                    <Skeleton className="h-3 w-16 bg-white/5" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
