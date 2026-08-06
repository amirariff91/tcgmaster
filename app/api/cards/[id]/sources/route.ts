import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServerClient as createServiceRoleClient } from '@/lib/supabase/client';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Editing a card's source URLs steers what the price pipeline scrapes, so it
    // must never be reachable anonymously. `cards` is RLS public-read/no-write,
    // so the write itself needs the service-role client — which makes the auth
    // check here the only thing standing in front of it.
    const authClient = await createClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('cards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error('Error updating sources:', error);
    const message = error instanceof Error ? error.message : 'Failed to update sources.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
