import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Explicitly pick allowed fields
    const updates: Record<string, string | null> = {};
    if ('snkrdunk_url' in body) updates.snkrdunk_url = body.snkrdunk_url || null;
    if ('pricecharting_url' in body) updates.pricecharting_url = body.pricecharting_url || null;
    if ('yuyutei_url' in body) updates.yuyutei_url = body.yuyutei_url || null;
    if ('cardrush_url' in body) updates.cardrush_url = body.cardrush_url || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields provided to update.' }, { status: 400 });
    }

    // Always reset curation status to trigger pipeline verification of the new URLs
    updates.curation_status = 'pending';
    updates.last_price_fetch = null; // force immediate fetch

    const supabase = await createServerClient();
    
    const { data, error } = await supabase
      .from('cards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error updating sources:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
