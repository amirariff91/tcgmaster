import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-server';
import { dbQuery } from '@/lib/db/client';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Editing a card's source URLs steers what the price pipeline scrapes, so it
    // must never be reachable anonymously. `cards` is RLS public-read/no-write,
    // so the write itself needs the service-role client — which makes the auth
    // check here the only thing standing in front of it.
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization: rewriting a card's scraper URLs steers what the pipeline
    // scrapes and can poison append-only price history, so it must be restricted
    // to trusted curators, not every signed-in user. No role concept exists, so
    // gate on an explicit ADMIN_EMAILS allowlist (comma-separated).
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (adminEmails.length === 0 || !adminEmails.includes((user.email || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden: curator access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;

    // Explicitly pick allowed fields
    const updates: Record<string, string | null> = {};
    if ('snkrdunk_url' in body) updates.snkrdunk_url = typeof body.snkrdunk_url === 'string' ? body.snkrdunk_url : null;
    if ('pricecharting_url' in body) updates.pricecharting_url = typeof body.pricecharting_url === 'string' ? body.pricecharting_url : null;
    if ('yuyutei_url' in body) updates.yuyutei_url = typeof body.yuyutei_url === 'string' ? body.yuyutei_url : null;
    if ('cardrush_url' in body) updates.cardrush_url = typeof body.cardrush_url === 'string' ? body.cardrush_url : null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields provided to update.' }, { status: 400 });
    }

    // Always reset curation status to trigger pipeline verification of the new URLs
    updates.curation_status = 'pending';
    updates.last_price_fetch = null; // force immediate fetch

    const updateFields = Object.keys(updates);
    const updateValues = updateFields.map((field) => updates[field]);
    const setClause = updateFields
      .map((field, index) => `${field} = $${index + 1}`)
      .join(', ');
    const rows = await dbQuery<Record<string, unknown>>(`
      UPDATE cards
      SET ${setClause}
      WHERE id = $${updateValues.length + 1}
      RETURNING *
    `, [...updateValues, id]);
    const data = rows[0];

    if (!data) throw new Error('Card not found');

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error('Error updating sources:', error);
    const message = error instanceof Error ? error.message : 'Failed to update sources.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
