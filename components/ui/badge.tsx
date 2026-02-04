import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-zinc-900 text-white',
        secondary:
          'border-transparent bg-zinc-100 text-zinc-900',
        destructive:
          'border-transparent bg-red-100 text-red-700',
        success:
          'border-transparent bg-emerald-100 text-emerald-700',
        warning:
          'border-transparent bg-yellow-100 text-yellow-700',
        outline:
          'border border-zinc-300 text-zinc-700',
        grade:
          'border-transparent bg-gradient-to-r from-amber-500 to-yellow-400 text-white font-bold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
