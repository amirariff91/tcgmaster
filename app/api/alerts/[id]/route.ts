import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deletePriceAlert, toggleAlertActive } from '@/lib/pricing/alerts';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/alerts/[id] - Toggle alert active status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // toggleAlertActive reads current state and flips it; we just call it with the alert id + userId
  const success = await toggleAlertActive(id, user.id);

  if (!success) {
    return NextResponse.json({ error: 'Alert not found or update failed' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/alerts/[id] - Delete a price alert
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const success = await deletePriceAlert(id, user.id);

  if (!success) {
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
