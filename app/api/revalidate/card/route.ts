import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { dbQuery } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * On-demand ISR purge for a single card page, called by the price scrapers when
 * they write a new price. They run in a separate container (Dockerfile.scraper),
 * so they cannot call revalidatePath() themselves — hence this endpoint.
 *
 * Inngest price jobs do NOT use this: they execute inside this Next runtime
 * (Dockerfile.inngest points `-u` at /api/inngest here) and call revalidatePath
 * directly.
 *
 * The card page's cache entry is tagged `_N_T_/{game}/{set}/{card}` — the literal
 * request pathname — so revalidatePath must be given the resolved path with no
 * `type` argument. Passing the bracketed route pattern without `type` only warns
 * and no-ops.
 */
export async function POST(request: Request) {
  try {
    // Deny by default: an unset CRON_SECRET must not make this endpoint public.
    // Same pattern as app/api/cron/trending/route.ts.
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ revalidated: false, error: 'Unauthorized' }, { status: 401 });
    }

    let cardId: unknown;
    try {
      ({ cardId } = await request.json());
    } catch {
      return NextResponse.json({ revalidated: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    if (typeof cardId !== 'string' || !UUID_RE.test(cardId)) {
      return NextResponse.json(
        { revalidated: false, error: 'cardId must be a UUID' },
        { status: 400 }
      );
    }

    const rows = await dbQuery<{ card_slug: string; set_slug: string; game_slug: string }>(`
      SELECT
        c.slug AS card_slug,
        s.slug AS set_slug,
        g.slug AS game_slug
      FROM cards c
      JOIN sets s ON s.id = c.set_id
      JOIN games g ON g.id = s.game_id
      WHERE c.id = $1
      LIMIT 1
    `, [cardId]);

    const row = rows[0];
    const cardSlug = row?.card_slug;
    const setSlug = row?.set_slug;
    const gameSlug = row?.game_slug;

    if (!cardSlug || !setSlug || !gameSlug) {
      return NextResponse.json({ revalidated: false, error: 'Card not found' }, { status: 404 });
    }

    const path = `/${gameSlug}/${setSlug}/${cardSlug}`;
    revalidatePath(path);

    return NextResponse.json({ revalidated: true, path });
  } catch (error: unknown) {
    // Log the detail, return a generic message — no internals over the wire.
    console.error('[revalidate/card] failed:', error);
    return NextResponse.json(
      { revalidated: false, error: 'Revalidation failed' },
      { status: 500 }
    );
  }
}
