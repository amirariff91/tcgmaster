import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db/client';

export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const { slug, insertRows, url } = data;

    if (!slug || !insertRows || !Array.isArray(insertRows)) {
      return NextResponse.json({ success: false, error: 'Invalid data' }, { status: 400 });
    }

    // 1. Get the card ID
    const cards = await dbQuery("SELECT id FROM cards WHERE slug = $1", [slug]);
    if (cards.length === 0) {
      return NextResponse.json({ success: false, error: 'Card not found' }, { status: 404 });
    }
    const cardId = cards[0].id;

    // 2. Add card_id to insertRows
    const rowsWithCardId = insertRows.map(row => ({
      ...row,
      card_id: cardId
    }));

    if (rowsWithCardId.length > 0) {
      // 3. Quarantine old data
      await dbQuery(`
        INSERT INTO price_quarantine (card_id, source, grade, price, currency, observed_at, reason, evidence, price_kind)
        SELECT card_id, source, grade, price, currency, recorded_at, 'manual-mapping-correction', '{}'::jsonb, 'retail_sell'
        FROM price_history
        WHERE card_id = $1 AND source = 'pricecharting'
      `, [cardId]);

      // 4. Delete old data
      await dbQuery(`DELETE FROM price_history WHERE card_id = $1 AND source = 'pricecharting'`, [cardId]);

      // 5. Insert new data
      await dbQuery(`
        INSERT INTO price_history (card_id, source, grade, grading_company_id, price, currency, recorded_at)
        SELECT card_id, source::price_source, grade, grading_company_id, price, currency, recorded_at
        FROM jsonb_to_recordset($1::jsonb) AS rows(
          card_id uuid, source text, grade text, grading_company_id uuid,
          price numeric, currency text, recorded_at timestamptz
        )`,
        [JSON.stringify(rowsWithCardId)]
      );

      // 6. Update the correct URL
      if (url) {
        await dbQuery(`UPDATE cards SET pricecharting_url = $1, pc_fetched = TRUE WHERE id = $2`, [url, cardId]);
      }
    }

    console.log(`[Ingest PC API] Successfully saved ${rowsWithCardId.length} records for ${slug}`);
    return NextResponse.json({ success: true, count: rowsWithCardId.length });
  } catch (error: any) {
    console.error("[Ingest PC API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
