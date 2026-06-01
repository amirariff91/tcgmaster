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

  const { cardId, variantId, grade, gradingCompanyId, thresholdPercent, direction, deliveryMethod } = body as {
    cardId?: string;
    variantId?: string;
    grade?: string;
    gradingCompanyId?: string;
    thresholdPercent?: number;
    direction?: 'up' | 'down' | 'both';
    deliveryMethod?: 'email' | 'push' | 'both';
  };

  if (!cardId) {
    return NextResponse.json({ error: 'cardId is required' }, { status: 400 });
  }

  if (!thresholdPercent || thresholdPercent <= 0) {
    return NextResponse.json({ error: 'thresholdPercent must be a positive number' }, { status: 400 });
  }

  const alert = await createPriceAlert({
    userId: user.id,
    cardId,
    variantId,
    grade,
    gradingCompanyId,
    thresholdPercent,
    direction,
    deliveryMethod,
  });

  if (!alert) {
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }

  return NextResponse.json({ data: alert }, { status: 201 });
}
