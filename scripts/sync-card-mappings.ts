import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function syncMappings() {
  console.log('🔄 Starting card_source_mapping two-way synchronization...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Sync PriceCharting URLs from cards into card_source_mapping as 'confirmed'
    const pcRes = await client.query(`
      INSERT INTO card_source_mapping (
        card_id, source, external_url, external_title, confidence, matched_by, evidence, verified_at, updated_at
      )
      SELECT 
        c.id, 'pricecharting', c.pricecharting_url, c.name, 'confirmed', 'url',
        '{"origin": "cards-table-sync"}'::jsonb, NOW(), NOW()
      FROM cards c
      WHERE c.pricecharting_url IS NOT NULL
      ON CONFLICT (card_id, source) DO UPDATE SET
        external_url = EXCLUDED.external_url,
        external_title = EXCLUDED.external_title,
        confidence = 'confirmed',
        matched_by = 'url',
        verified_at = NOW(),
        updated_at = NOW()
      WHERE card_source_mapping.confidence != 'confirmed' 
         OR card_source_mapping.external_url != EXCLUDED.external_url;
    `);
    console.log(`✅ Synced ${pcRes.rowCount} PriceCharting mappings to 'confirmed'.`);

    // 2. Sync SnkrDunk URLs from cards into card_source_mapping as 'confirmed'
    const snkrRes = await client.query(`
      INSERT INTO card_source_mapping (
        card_id, source, external_url, external_title, confidence, matched_by, evidence, verified_at, updated_at
      )
      SELECT 
        c.id, 'snkrdunk', c.snkrdunk_url, c.name, 'confirmed', 'url',
        '{"origin": "cards-table-sync"}'::jsonb, NOW(), NOW()
      FROM cards c
      WHERE c.snkrdunk_url IS NOT NULL
      ON CONFLICT (card_id, source) DO UPDATE SET
        external_url = EXCLUDED.external_url,
        external_title = EXCLUDED.external_title,
        confidence = 'confirmed',
        matched_by = 'url',
        verified_at = NOW(),
        updated_at = NOW()
      WHERE card_source_mapping.confidence != 'confirmed' 
         OR card_source_mapping.external_url != EXCLUDED.external_url;
    `);
    console.log(`✅ Synced ${snkrRes.rowCount} SnkrDunk mappings to 'confirmed'.`);

    // 3. Sync Yuyutei URLs from cards into card_source_mapping as 'confirmed'
    const yytRes = await client.query(`
      INSERT INTO card_source_mapping (
        card_id, source, external_url, external_title, confidence, matched_by, evidence, verified_at, updated_at
      )
      SELECT 
        c.id, 'yuyutei', c.yuyutei_url, c.name, 'confirmed', 'url',
        '{"origin": "cards-table-sync"}'::jsonb, NOW(), NOW()
      FROM cards c
      WHERE c.yuyutei_url IS NOT NULL
      ON CONFLICT (card_id, source) DO UPDATE SET
        external_url = EXCLUDED.external_url,
        external_title = EXCLUDED.external_title,
        confidence = 'confirmed',
        matched_by = 'url',
        verified_at = NOW(),
        updated_at = NOW()
      WHERE card_source_mapping.confidence != 'confirmed' 
         OR card_source_mapping.external_url != EXCLUDED.external_url;
    `);
    console.log(`✅ Synced ${yytRes.rowCount} Yuyutei mappings to 'confirmed'.`);

    await client.query('COMMIT');
    console.log('🌟 Sync completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Sync failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

syncMappings().catch(console.error);
