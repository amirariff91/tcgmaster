'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service in production
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body className="bg-zinc-950 text-zinc-100 flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md px-4">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-950">
            <svg
              className="h-8 w-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Page failed to load</h1>
          <p className="mt-3 text-zinc-400">
            Something unexpected happened. Try refreshing — if it keeps happening, we&apos;re on it.
          </p>
          {error?.digest && (
            <p className="mt-2 text-xs text-zinc-600">
              Error ID: {error.digest}
            </p>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={reset}
              className="rounded-lg bg-zinc-800 px-6 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 transition-colors"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 transition-colors"
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
