'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ options, value, onChange, placeholder = 'Select...', className, disabled }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const selectRef = React.useRef<HTMLDivElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);
    const scrollPosRef = React.useRef(0);

    const selectedOption = options.find((opt) => opt.value === value);

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    React.useLayoutEffect(() => {
      if (isOpen && listRef.current) {
        listRef.current.scrollTop = scrollPosRef.current;
      }
    }, [isOpen]);

    return (
      <div ref={ref} className={cn('relative w-full', className)}>
        <div ref={selectRef}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-lg border border-white/10 bg-[#0b1329]/80 backdrop-blur-sm px-3 py-2 text-sm ring-offset-[#060c18] transition-all hover:bg-white/5 hover:border-orange-500/30 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
              isOpen && 'ring-2 ring-orange-500 ring-offset-2 border-orange-500/50'
            )}
          >
            <span className={cn("truncate text-left text-zinc-100", !selectedOption && 'text-zinc-400')}>
              {selectedOption?.label ?? placeholder}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-zinc-400 transition-transform',
                isOpen && 'rotate-180 text-orange-400'
              )}
            />
          </button>

          {isOpen && (
            <div 
              ref={listRef}
              onScroll={(e) => scrollPosRef.current = e.currentTarget.scrollTop}
              className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-white/10 bg-[#060c18]/95 backdrop-blur-md py-1 shadow-xl shadow-black/50"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange?.(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-300 hover:bg-orange-500/20 hover:text-white transition-colors',
                    option.value === value && 'bg-orange-500/10 text-orange-400 font-medium'
                  )}
                >
                  <span className="flex-1 truncate text-left">{option.label}</span>
                  {option.value === value && (
                    <Check className="h-4 w-4 text-orange-400 shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);
Select.displayName = 'Select';

export { Select, type SelectOption };
