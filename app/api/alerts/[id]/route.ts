import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-server';
import { dbQuery } from '@/lib/db/client';
import { deletePriceAlert, toggleAlertActive } from '@/lib/pricing/alerts';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/alerts/[id] - Toggle alert active status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser();

  if (!user) {
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
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if the alert exists and belongs to this user before deleting
  let existing: { id: string } | undefined;
  try {
    const rows = await dbQuery<{ id: string }>(`
      SELECT id
      FROM price_alerts
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
    `, [id, user.id]);
    existing = rows[0];
  } catch {
    existing = undefined;
  }

  if (!existing) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
  }

  try {
    await deletePriceAlert(id, user.id);
  } catch {
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
