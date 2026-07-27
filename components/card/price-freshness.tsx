'use client';

import * as React from 'react';

interface PriceFreshnessProps {
  /** ISO timestamp of the newest price observation we hold, or null if none. */
  newestPriceAt: string | null;
  className?: string;
}

function formatRelative(newestPriceAt: string): { label: string; isStale: boolean } {
  const hours = (Date.now() - new Date(newestPriceAt).getTime()) / 36e5;
  if (hours < 1) return { label: '<1h', isStale: false };
  if (hours < 48) return { label: `${Math.round(hours)}h`, isStale: hours >= 24 };
  return { label: `${Math.round(hours / 24)}d`, isStale: true };
}

/** Short absolute form, e.g. "27 Jul" — deterministic enough to render on the server. */
function formatAbsolute(newestPriceAt: string): string {
  const date = new Date(newestPriceAt);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * "Last Updated" for the card page.
 *
 * This has to be a client component. Card pages are cached for 24h, so anything
 * derived from `Date.now()` during render freezes into the ISR payload — a page
 * rendered right after a price write would keep claiming "<1h" for a full day,
 * and the stale warning could never fire truthfully. Computing it in the browser
 * keeps the label honest no matter how long the page has been cached.
 *
 * The server pass renders the absolute date instead of a placeholder, so the HTML
 * still carries real, indexable content and there is no hydration mismatch; the
 * relative label takes over after mount.
 */
export function PriceFreshness({ newestPriceAt, className }: PriceFreshnessProps) {
  const [mounted, setMounted] = React.useState(false);
  const [, forceTick] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    setMounted(true);
    // Recompute periodically: the label is only ever as fresh as its last render,
    // and a left-open tab would otherwise keep asserting "<1h" indefinitely —
    // the same defect this component exists to fix, just on a slower clock.
    const id = setInterval(forceTick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!newestPriceAt) {
    return <span className={`text-2xl font-black text-white ${className ?? ''}`}>--</span>;
  }

  const relative = mounted ? formatRelative(newestPriceAt) : null;

  return (
    <time
      dateTime={newestPriceAt}
      // min-width keeps the absolute -> relative swap from shifting the row
      className={`text-2xl font-black tabular-nums inline-block min-w-[3.5ch] ${
        relative?.isStale ? 'text-amber-400' : 'text-white'
      } ${className ?? ''}`}
    >
      {relative ? relative.label : formatAbsolute(newestPriceAt)}
    </time>
  );
}
