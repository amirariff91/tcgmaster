/**
 * Price Alerts Service
 * Hybrid batch + websocket implementation
 */

import { createServerClient } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';
import { lookupGraded, normalizeGrade } from '@/lib/pricing/grades';

export interface TriggeredAlert {
  alertId: string;
  userId: string;
  cardId: string;
  cardName: string;
  setName: string;
  grade: string;
  previousPrice: number;
  currentPrice: number;
  percentChange: number;
  direction: 'up' | 'down';
  deliveryMethod: 'email' | 'push' | 'both';
}

interface AlertRow {
  id: string;
  user_id: string;
  card_id: string;
  variant_id: string | null;
  grade: string;
  grading_company_id: string | null;
  threshold_percent: number;
  direction: 'up' | 'down' | 'both';
  baseline_price: number | null;
  delivery_method: 'email' | 'push' | 'both';
  trigger_count?: number;
  cards: {
    id: string;
    name: string;
    tcg_player_id: string | null;
    sets: { name: string };
  };
}

interface CurrentPriceRow {
  headline_cents: number | null;
  graded_prices: Record<string, { average?: number | null }>;
}

interface UserAlertRow {
  id: string;
  user_id: string;
  card_id: string;
  variant_id: string | null;
  grade: string;
  grading_company_id: string | null;
  threshold_percent: number;
  direction: 'up' | 'down' | 'both';
  baseline_price: number | null;
  is_active: boolean;
  last_triggered: string | null;
  trigger_count: number;
  delivery_method: 'email' | 'push' | 'both';
  created_at: string;
  cards: {
    name: string;
    image_url: string | null;
    local_image_url: string | null;
    sets: { name: string };
  };
}

/**
 * Check all active alerts and trigger notifications
 * Called by Inngest cron job every 4-6 hours
 */
export async function checkAllAlerts(): Promise<{
  checked: number;
  triggered: number;
  errors: string[];
}> {
  const supabase = createServerClient();
  const errors: string[] = [];
  let checked = 0;
  let triggered = 0;

  try {
    // Get all active alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('price_alerts')
      .select(`
        id,
        user_id,
        card_id,
        variant_id,
        grade,
        grading_company_id,
        threshold_percent,
        direction,
        baseline_price,
        delivery_method,
        cards!inner (
          id,
          name,
          tcg_player_id,
          sets!inner (name)
        )
      `)
      .eq('is_active', true);

    if (alertsError) {
      errors.push(`Failed to fetch alerts: ${alertsError.message}`);
      return { checked: 0, triggered: 0, errors };
    }

    const typedAlerts = alerts as AlertRow[] | null;

    if (!typedAlerts || typedAlerts.length === 0) {
      return { checked: 0, triggered: 0, errors };
    }

    for (const alert of typedAlerts) {
      try {
        checked++;

        // Get the single current price row for this card.
        const { data: currentPriceData } = await supabase
          .from('card_price_current')
          .select('headline_cents, graded_prices')
          .eq('card_id', alert.card_id)
          .maybeSingle();

        const currentPriceRow = currentPriceData as CurrentPriceRow | null;

        if (!currentPriceRow) continue;

        // Determine which price to check based on grade
        let currentPrice: number | null = null;
        const rawValue = currentPriceRow.headline_cents === null
          ? null
          : currentPriceRow.headline_cents / 100;
        const gradedPrices = currentPriceRow.graded_prices;

        const grade = normalizeGrade(alert.grade);
        if (grade === 'raw') {
          currentPrice = rawValue;
        } else {
          currentPrice = lookupGraded(gradedPrices, grade)?.average || null;
        }

        if (currentPrice === null || alert.baseline_price === null) continue;

        // Calculate percent change
        const percentChange = ((currentPrice - alert.baseline_price) / alert.baseline_price) * 100;
        const absChange = Math.abs(percentChange);

        // Check if threshold is met
        const thresholdMet = absChange >= alert.threshold_percent;
        const directionMatch =
          alert.direction === 'both' ||
          (alert.direction === 'up' && percentChange > 0) ||
          (alert.direction === 'down' && percentChange < 0);

        if (thresholdMet && directionMatch) {
          const card = alert.cards;
          const set = card?.sets;

          const triggeredAlert: TriggeredAlert = {
            alertId: alert.id,
            userId: alert.user_id,
            cardId: alert.card_id,
            cardName: card?.name || '',
            setName: set?.name || '',
            grade: alert.grade,
            previousPrice: alert.baseline_price,
            currentPrice,
            percentChange,
            direction: percentChange > 0 ? 'up' : 'down',
            deliveryMethod: alert.delivery_method,
          };

          // Queue notification
          await queueAlertNotification(triggeredAlert);

          // Update alert
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('price_alerts') as any)
            .update({
              last_triggered: new Date().toISOString(),
              trigger_count: (alert.trigger_count || 0) + 1,
              baseline_price: currentPrice, // Update baseline to current
            })
            .eq('id', alert.id);

          triggered++;
        }
      } catch (err) {
        errors.push(`Alert ${alert.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return { checked, triggered, errors };
}

/**
 * Queue an alert notification
 */
async function queueAlertNotification(alert: TriggeredAlert): Promise<void> {
  const supabase = createServerClient();

  const direction = alert.direction === 'up' ? 'increased' : 'decreased';
  const emoji = alert.direction === 'up' ? '+' : '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('notification_queue') as any).insert({
    user_id: alert.userId,
    type: 'price_alert',
    title: `Price Alert: ${alert.cardName}`,
    body: `${alert.cardName} (${alert.grade}) has ${direction} by ${emoji}${alert.percentChange.toFixed(1)}%. Now $${alert.currentPrice.toLocaleString()}.`,
    data: {
      alertId: alert.alertId,
      cardId: alert.cardId,
      previousPrice: alert.previousPrice,
      currentPrice: alert.currentPrice,
      percentChange: alert.percentChange,
    },
  });
}

/**
 * Create a new price alert
 */
export async function createPriceAlert(params: {
  userId: string;
  cardId: string;
  variantId?: string;
  grade?: string;
  gradingCompanyId?: string;
  thresholdPercent: number;
  direction?: 'up' | 'down' | 'both';
  deliveryMethod?: 'email' | 'push' | 'both';
}): Promise<Tables<'price_alerts'> | null> {
  const supabase = createServerClient();

  // Get current price for baseline
  const { data: currentPriceData } = await supabase
    .from('card_price_current')
    .select('headline_cents, graded_prices')
    .eq('card_id', params.cardId)
    .maybeSingle();

  const currentPrice = currentPriceData as CurrentPriceRow | null;

  const normalizedGrade = normalizeGrade(params.grade);
  let baselinePrice: number | null = null;
  if (currentPrice) {
    const rawValue = currentPrice.headline_cents === null
      ? null
      : currentPrice.headline_cents / 100;
    const gradedPrices = currentPrice.graded_prices;

    if (normalizedGrade === 'raw') {
      baselinePrice = rawValue;
    } else {
      baselinePrice = lookupGraded(gradedPrices, normalizedGrade)?.average || null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('price_alerts') as any)
    .insert({
      user_id: params.userId,
      card_id: params.cardId,
      variant_id: params.variantId,
      grade: normalizedGrade,
      grading_company_id: params.gradingCompanyId,
      threshold_percent: params.thresholdPercent,
      direction: params.direction || 'both',
      baseline_price: baselinePrice,
      delivery_method: params.deliveryMethod || 'email',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create alert:', error);
    throw error;
  }

  return data;
}

/**
 * Get alerts for a user
 */
export async function getUserAlerts(userId: string): Promise<Array<{
  alert: Tables<'price_alerts'>;
  card: {
    name: string;
    setName: string;
    imageUrl: string | null;
    currentPrice: number | null;
  };
}>> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('price_alerts')
    .select(`
      *,
      cards!inner (
        name,
        image_url,
        local_image_url,
        sets!inner (name)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const typedData = data as UserAlertRow[] | null;

  if (!typedData) return [];

  return typedData.map((row) => {
    const card = row.cards;
    const set = card?.sets;

    return {
      alert: {
        id: row.id,
        user_id: row.user_id,
        card_id: row.card_id,
        variant_id: row.variant_id,
        grade: row.grade,
        grading_company_id: row.grading_company_id,
        threshold_percent: row.threshold_percent,
        direction: row.direction,
        baseline_price: row.baseline_price,
        is_active: row.is_active,
        last_triggered: row.last_triggered,
        trigger_count: row.trigger_count,
        delivery_method: row.delivery_method,
        created_at: row.created_at,
      },
      card: {
        name: card?.name || '',
        setName: set?.name || '',
        imageUrl: card?.local_image_url || card?.image_url || null,
        currentPrice: null, // Would need price cache join
      },
    };
  });
}

/**
 * Delete a price alert
 */
export async function deletePriceAlert(alertId: string, userId: string): Promise<boolean> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from('price_alerts')
    .delete()
    .eq('id', alertId)
    .eq('user_id', userId);

  if (error) throw error;
  return true;
}

/**
 * Toggle alert active status
 */
export async function toggleAlertActive(alertId: string, userId: string): Promise<boolean> {
  const supabase = createServerClient();

  // Get current status
  const { data: alertData } = await supabase
    .from('price_alerts')
    .select('is_active')
    .eq('id', alertId)
    .eq('user_id', userId)
    .single();

  const alert = alertData as { is_active: boolean } | null;

  if (!alert) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('price_alerts') as any)
    .update({ is_active: !alert.is_active })
    .eq('id', alertId)
    .eq('user_id', userId);

  return !error;
}
