'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center"
    >
      <div className="mx-auto max-w-md">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>

        <h1 className="mb-2 text-xl font-semibold text-zinc-900">
          Something went wrong
        </h1>
        <p className="mb-2 text-sm text-zinc-500">
          We hit an unexpected error loading this page. The issue has been
          logged and we&apos;ll look into it.
        </p>
        {error?.digest && (
          <p className="text-xs text-zinc-500 mt-2">
            Error ID: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
