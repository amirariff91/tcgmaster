/**
 * Tell the web app to purge a card page's ISR entry after a price write.
 *
 * The scrapers run in their own container, so they reach the Next.js runtime over
 * HTTP (app/api/revalidate/card). Card pages sit at `revalidate = 86400`, so this
 * call is what keeps them fresh — but a scrape is worth more than a cache purge,
 * so every failure mode here degrades to "page stays stale until the next write or
 * the TTL" and never disturbs the worker loop.
 *
 * Deliberately:
 *  - never throws (the queue loops have no try/catch; a throw kills the process)
 *  - never retries (the next scrape of this card retries implicitly)
 *  - no-ops when unconfigured, so a missing env var cannot stall scraping
 *  - bounded by a short timeout, so a hung web app cannot slow the queue
 */
const REVALIDATE_TIMEOUT_MS = 3000;

export async function revalidateCardPage(cardId: string, label: string): Promise<void> {
  const secret = process.env.CRON_SECRET;
  // Tolerate a trailing slash — `https://tcgmaster.com/` would otherwise produce
  // `//api/revalidate/card` and fail every purge with only a container log to show.
  const baseUrl = process.env.REVALIDATE_URL?.replace(/\/+$/, '');
  if (!baseUrl || !secret) return;

  try {
    const response = await fetch(`${baseUrl}/api/revalidate/card`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ cardId }),
      signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`${label} revalidate failed for ${cardId}: HTTP ${response.status}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${label} revalidate error for ${cardId}: ${message}`);
  }
}
