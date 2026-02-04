import { Metadata } from 'next';
import { Newspaper, PenLine, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Blog | TCGMaster',
  description:
    'Articles about collecting, investing, and market trends in the TCG world. Coming soon.',
  openGraph: {
    title: 'Blog | TCGMaster',
    description:
      'Articles about collecting, investing, and market trends in the TCG world. Coming soon.',
    type: 'website',
    siteName: 'TCGMaster',
  },
};

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="container py-20">
        <div className="max-w-md mx-auto text-center">
          {/* Icon Composition */}
          <div className="relative mb-8 inline-block">
            <div className="w-24 h-24 rounded-full bg-zinc-100 flex items-center justify-center">
              <Newspaper className="w-10 h-10 text-zinc-400" />
            </div>
            <div
              className={cn(
                'absolute -bottom-2 -right-2',
                'w-12 h-12 rounded-full',
                'bg-white border-2 border-zinc-100',
                'flex items-center justify-center',
                'shadow-sm'
              )}
            >
              <PenLine className="w-5 h-5 text-zinc-400" />
            </div>
            <div
              className={cn(
                'absolute -top-1 -left-1',
                'w-8 h-8 rounded-full',
                'bg-white border-2 border-zinc-100',
                'flex items-center justify-center',
                'shadow-sm'
              )}
            >
              <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
            </div>
          </div>

          {/* Text Content */}
          <h1 className="text-3xl font-bold text-zinc-900 mb-4">Blog Coming Soon</h1>
          <p className="text-zinc-600 mb-8">
            We&apos;re working on articles about collecting, investing, and market trends.
            Check back soon for expert insights and guides.
          </p>

          {/* Topics Preview */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {['Market Analysis', 'Collecting Tips', 'Investment Guides', 'Set Reviews'].map(
              (topic) => (
                <span
                  key={topic}
                  className={cn(
                    'px-3 py-1.5 rounded-full',
                    'bg-white border border-zinc-200',
                    'text-sm text-zinc-600'
                  )}
                >
                  {topic}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
