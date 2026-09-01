'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';

export function RefreshButton() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-zinc-300 hover:text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
    >
      <RotateCw className={`w-4 h-4 text-indigo-400 ${isRefreshing ? 'animate-spin' : ''}`} />
      Refresh Diagnostics
    </button>
  );
}
