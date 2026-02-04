'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackQuickAddUsed } from '@/lib/analytics';

interface QuickAddDropdownProps {
  cardId: string;
  cardName: string;
  onAdd?: (cardId: string, grade: string) => Promise<void>;
  className?: string;
}

const grades = [
  { value: 'raw', label: 'Raw' },
  { value: 'psa7', label: 'PSA 7' },
  { value: 'psa8', label: 'PSA 8' },
  { value: 'psa9', label: 'PSA 9' },
  { value: 'psa10', label: 'PSA 10' },
];

export function QuickAddDropdown({ cardId, cardName, onAdd, className }: QuickAddDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [addedGrade, setAddedGrade] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleAdd = async (grade: string) => {
    setIsLoading(true);
    try {
      await onAdd?.(cardId, grade);
      setAddedGrade(grade);
      trackQuickAddUsed(cardId, grade);

      // Reset after a short delay
      setTimeout(() => {
        setAddedGrade(null);
        setIsOpen(false);
      }, 1500);
    } catch (error) {
      console.error('Failed to add card:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          'flex items-center justify-center',
          'w-7 h-7 rounded-full',
          'bg-zinc-100 hover:bg-zinc-200',
          'text-zinc-500 hover:text-zinc-700',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
          addedGrade && 'bg-emerald-100 text-emerald-600'
        )}
        aria-label={`Add ${cardName} to collection`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {addedGrade ? (
          <Check className="h-4 w-4" />
        ) : isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
      </button>

      {isOpen && !addedGrade && (
        <div
          className={cn(
            'absolute right-0 top-full mt-1 z-50',
            'w-28 py-1 rounded-lg shadow-lg',
            'bg-white border border-zinc-200',
            'animate-in fade-in-0 zoom-in-95 duration-100'
          )}
          role="listbox"
          aria-label="Select grade"
          onClick={(e) => e.stopPropagation()}
        >
          {grades.map((grade) => (
            <button
              key={grade.value}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAdd(grade.value);
              }}
              disabled={isLoading}
              className={cn(
                'w-full px-3 py-1.5 text-left text-sm',
                'hover:bg-zinc-50',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-150'
              )}
              role="option"
              aria-selected={false}
            >
              {grade.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
