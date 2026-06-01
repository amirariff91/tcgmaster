import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAlerts, createPriceAlert } from '@/lib/pricing/alerts';

// GET /api/alerts - Get all alerts for the authenticated user
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const alerts = await getUserAlerts(user.id);

  return NextResponse.json({ data: alerts });
}

// POST /api/alerts - Create a new price alert
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const cardId = typeof body.cardId === 'string' ? body.cardId : undefined;
  const variantId = typeof body.variantId === 'string' ? body.variantId : undefined;
  const grade = typeof body.grade === 'string' ? body.grade : undefined;
  const gradingCompanyId = typeof body.gradingCompanyId === 'string' ? body.gradingCompanyId : undefined;

  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 });
  }

  const val = Number(body.thresholdPercent);
  if (!Number.isFinite(val) || val <= 0 || val > 100) {
    return NextResponse.json({ error: 'thresholdPercent must be a number between 0 and 100' }, { status: 400 });
  }
  const thresholdPercent = val;

  const VALID_DIRECTIONS = ['up', 'down', 'both'];
  if (body.direction && !VALID_DIRECTIONS.includes(body.direction as string)) {
    return NextResponse.json({ error: 'direction must be one of: up, down, both' }, { status: 400 });
  }
  const direction = body.direction as 'up' | 'down' | 'both' | undefined;

  const VALID_DELIVERY = ['email', 'push', 'both'];
  if (body.deliveryMethod && !VALID_DELIVERY.includes(body.deliveryMethod as string)) {
    return NextResponse.json({ error: 'deliveryMethod must be one of: email, push, both' }, { status: 400 });
  }
  const deliveryMethod = body.deliveryMethod as 'email' | 'push' | 'both' | undefined;

  let alert;
  try {
    alert = await createPriceAlert({
      userId: user.id,
      cardId,
      variantId,
      grade,
      gradingCompanyId,
      thresholdPercent,
      direction,
      deliveryMethod,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }

  if (!alert) {
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }

  return NextResponse.json({ data: alert }, { status: 201 });
}
