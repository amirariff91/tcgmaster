/**
 * Price Alerts Service
 * Hybrid batch + websocket implementation
 */

import { dbQuery } from '@/lib/db/client';
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
  const errors: string[] = [];
  let checked = 0;
  let triggered = 0;

  try {
    // Get all active alerts
    const alerts = await dbQuery<AlertRow>(`
      SELECT
        pa.id,
        pa.user_id,
        pa.card_id,
        pa.variant_id,
        pa.grade,
        pa.grading_company_id,
        pa.threshold_percent::float8 AS threshold_percent,
        pa.direction,
        pa.baseline_price::float8 AS baseline_price,
        pa.delivery_method,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'tcg_player_id', c.tcg_player_id,
          'sets', json_build_object('name', s.name)
        ) AS cards
      FROM price_alerts pa
      JOIN cards c ON c.id = pa.card_id
      JOIN sets s ON s.id = c.set_id
      WHERE pa.is_active = true
    `);

    if (!alerts) {
      errors.push('Failed to fetch alerts: no rows returned');
      return { checked: 0, triggered: 0, errors };
    }

    const typedAlerts = alerts;

    if (!typedAlerts || typedAlerts.length === 0) {
      return { checked: 0, triggered: 0, errors };
    }

    for (const alert of typedAlerts) {
      try {
        checked++;

        // Get the single current price row for this card.
        const currentPriceRows = await dbQuery<CurrentPriceRow>(`
          SELECT headline_cents, graded_prices
          FROM card_price_current
          WHERE card_id = $1
          LIMIT 1
        `, [alert.card_id]);
        const currentPriceRow = currentPriceRows[0] || null;

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
          await dbQuery(
            `
              UPDATE price_alerts
              SET last_triggered = $1,
                  trigger_count = $2,
                  baseline_price = $3
              WHERE id = $4
                AND user_id = $5
            `,
            [
              new Date().toISOString(),
              (alert.trigger_count || 0) + 1,
              currentPrice,
              alert.id,
              alert.user_id,
            ],
          );

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
  const direction = alert.direction === 'up' ? 'increased' : 'decreased';
  const emoji = alert.direction === 'up' ? '+' : '';

  await dbQuery(
    `
      INSERT INTO notification_queue (user_id, type, title, body, data)
      VALUES ($1, 'price_alert', $2, $3, $4)
    `,
    [
      alert.userId,
      `Price Alert: ${alert.cardName}`,
      `${alert.cardName} (${alert.grade}) has ${direction} by ${emoji}${alert.percentChange.toFixed(1)}%. Now $${alert.currentPrice.toLocaleString()}.`,
      JSON.stringify({
        alertId: alert.alertId,
        cardId: alert.cardId,
        previousPrice: alert.previousPrice,
        currentPrice: alert.currentPrice,
        percentChange: alert.percentChange,
      }),
    ],
  );
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
  // Get current price for baseline
  const currentPriceRows = await dbQuery<CurrentPriceRow>(`
    SELECT headline_cents, graded_prices
    FROM card_price_current
    WHERE card_id = $1
    LIMIT 1
  `, [params.cardId]);
  const currentPrice = currentPriceRows[0] || null;

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

  try {
    const rows = await dbQuery<Tables<'price_alerts'>>(`
      INSERT INTO price_alerts (
        user_id,
        card_id,
        variant_id,
        grade,
        grading_company_id,
        threshold_percent,
        direction,
        baseline_price,
        delivery_method
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id,
        user_id,
        card_id,
        variant_id,
        grade,
        grading_company_id,
        threshold_percent::float8 AS threshold_percent,
        direction,
        baseline_price::float8 AS baseline_price,
        is_active,
        last_triggered,
        trigger_count,
        delivery_method,
        created_at
    `, [
      params.userId,
      params.cardId,
      params.variantId ?? null,
      normalizedGrade,
      params.gradingCompanyId ?? null,
      params.thresholdPercent,
      params.direction || 'both',
      baselinePrice,
      params.deliveryMethod || 'email',
    ]);
    const data = rows[0] || null;

    if (!data) {
      throw new Error('Alert insert returned no row');
    }

    return data;
  } catch (error) {
    console.error('Failed to create alert:', error);
    throw error;
  }
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
  const typedData = await dbQuery<UserAlertRow>(`
    SELECT
      pa.id,
      pa.user_id,
      pa.card_id,
      pa.variant_id,
      pa.grade,
      pa.grading_company_id,
      pa.threshold_percent::float8 AS threshold_percent,
      pa.direction,
      pa.baseline_price::float8 AS baseline_price,
      pa.is_active,
      pa.last_triggered,
      pa.trigger_count,
      pa.delivery_method,
      pa.created_at,
      json_build_object(
        'name', c.name,
        'image_url', c.image_url,
        'local_image_url', c.local_image_url,
        'sets', json_build_object('name', s.name)
      ) AS cards
    FROM price_alerts pa
    JOIN cards c ON c.id = pa.card_id
    JOIN sets s ON s.id = c.set_id
    WHERE pa.user_id = $1
    ORDER BY pa.created_at DESC
  `, [userId]);

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
  await dbQuery(
    `DELETE FROM price_alerts WHERE id = $1 AND user_id = $2`,
    [alertId, userId],
  );
  return true;
}

/**
 * Toggle alert active status
 */
export async function toggleAlertActive(alertId: string, userId: string): Promise<boolean> {
  // Get current status
  const alertRows = await dbQuery<{ is_active: boolean }>(`
    SELECT is_active
    FROM price_alerts
    WHERE id = $1
      AND user_id = $2
    LIMIT 1
  `, [alertId, userId]);
  const alert = alertRows[0] || null;

  if (!alert) return false;

  await dbQuery(
    `
      UPDATE price_alerts
      SET is_active = $1
      WHERE id = $2
        AND user_id = $3
    `,
    [!alert.is_active, alertId, userId],
  );

  return true;
}
