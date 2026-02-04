'use client';

import { Search, PackageOpen, Filter, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoCardsProps {
  searchQuery?: string;
  onClearSearch?: () => void;
  className?: string;
}

export function NoCards({ searchQuery, onClearSearch, className }: NoCardsProps) {
  const isSearching = Boolean(searchQuery);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4',
        'text-center',
        className
      )}
    >
      {/* Lucide icons composition */}
      <div className="relative mb-6">
        {/* Main icon */}
        <div className="w-24 h-24 rounded-full bg-zinc-100 flex items-center justify-center">
          {isSearching ? (
            <Search className="w-10 h-10 text-zinc-400" />
          ) : (
            <PackageOpen className="w-10 h-10 text-zinc-400" />
          )}
        </div>

        {/* Accent icon */}
        <div
          className={cn(
            'absolute -bottom-1 -right-1',
            'w-10 h-10 rounded-full',
            'bg-white border-2 border-zinc-100',
            'flex items-center justify-center'
          )}
        >
          {isSearching ? (
            <Filter className="w-4 h-4 text-zinc-400" />
          ) : (
            <Search className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      </div>

      {/* Text */}
      <h3 className="text-lg font-semibold text-zinc-900 mb-2">
        {isSearching ? 'No cards found' : 'No cards available'}
      </h3>

      <p className="text-zinc-500 max-w-sm mb-6">
        {isSearching
          ? `We couldn't find any cards matching "${searchQuery}". Try adjusting your search.`
          : 'This set doesn\'t have any cards listed yet. Check back soon!'}
      </p>

      {/* Action */}
      {isSearching && onClearSearch && (
        <button
          type="button"
          onClick={onClearSearch}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
            'text-sm font-medium',
            'bg-zinc-900 text-white',
            'hover:bg-zinc-800',
            'focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2',
            'transition-colors duration-150'
          )}
        >
          <RotateCcw className="w-4 h-4" />
          Clear search
        </button>
      )}
    </div>
  );
}

// Generic empty state for other pages
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-4',
        'text-center',
        className
      )}
    >
      <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center mb-6">
        <Icon className="w-8 h-8 text-zinc-400" />
      </div>

      <h3 className="text-lg font-semibold text-zinc-900 mb-2">{title}</h3>

      <p className="text-zinc-500 max-w-sm mb-6">{description}</p>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
            'text-sm font-medium',
            'bg-zinc-900 text-white',
            'hover:bg-zinc-800',
            'focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2',
            'transition-colors duration-150'
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
