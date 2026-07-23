import { Metadata } from 'next';
import { Activity, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { GlobalPlatformHealth } from '@/components/admin/global-health';
import { AIWorkerClusters } from '@/components/admin/ai-workers';
import { GameScrapers } from '@/components/admin/game-scrapers';
import { RefreshButton } from '@/components/admin/refresh-button';

export const metadata: Metadata = {
  title: 'Mission Control | TCGMaster Admin',
  description: 'Surgical diagnostics for automated data pipelines and scrapers.',
};

export const revalidate = 0;

function LoadingSection({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 border border-white/5 rounded-2xl bg-[#0b1329]/50 animate-pulse">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
      <p className="text-zinc-400 font-medium">Booting {title} Array...</p>
    </div>
  );
}

export default function AdminHealthDashboard() {
  return (
    <div className="min-h-screen bg-[#060c18] pt-24 pb-20">
      <div className="container max-w-[1200px] mx-auto px-4 sm:px-6 space-y-12">
        
        {/* Header (Instantly Loads) */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-400" />
              Mission Control
            </h1>
            <p className="text-zinc-400 font-medium mt-1">Surgical diagnostics for automated data pipelines and scrapers.</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex items-center gap-3">
            <RefreshButton />
            <Link 
              href="https://app.inngest.com" 
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-sm font-bold text-indigo-400 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            >
              <ExternalLink className="w-4 h-4" />
              Inngest Dashboard
            </Link>
          </div>
        </div>

        {/* Global Summary (Streaming) */}
        <Suspense fallback={<LoadingSection title="Platform Diagnostics" />}>
          <GlobalPlatformHealth />
        </Suspense>

        {/* AI Worker Clusters (Streaming) */}
        <Suspense fallback={<LoadingSection title="Neural Networks" />}>
          <AIWorkerClusters />
        </Suspense>

        {/* TCG Game-by-Game Scrapers (Streaming) */}
        <Suspense fallback={<LoadingSection title="Scraping Engines" />}>
          <GameScrapers />
        </Suspense>

      </div>
    </div>
  );
}
