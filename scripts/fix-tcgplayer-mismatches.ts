import { pool } from "../lib/db/client";
import { syncDualEngineSales } from "./sync-tcgplayer-dual-engine";

interface ManualCorrection {
  slug: string;
  externalId: string | number;
  externalTitle: string;
}

const PRIMARY_CORRECTIONS: ManualCorrection[] = [
  // 1. OP13-120 Sabo Family
  { slug: "op-op13-120", externalId: "657410", externalTitle: "Sabo (120)" },
  { slug: "op-op13-120_p1", externalId: "657413", externalTitle: "Sabo (120) (Parallel)" },
  { slug: "op-op13-120_p2", externalId: "657412", externalTitle: "Sabo (120) (Super Alternate Art)" },
  { slug: "op-op13-120_p3", externalId: "657411", externalTitle: "Sabo (120) (Red Super Alternate Art)" },
  { slug: "op-op13-120_p4", externalId: "657414", externalTitle: "Sabo (120) (Wanted Poster)" },

  // 2. OP09-051 Buggy Family
  { slug: "op-op09-051", externalId: "596983", externalTitle: "Buggy (051)" },
  { slug: "op-op09-051_p1", externalId: "596985", externalTitle: "Buggy (051) (Alternate Art)" },
  { slug: "op-op09-051_p2", externalId: "596984", externalTitle: "Buggy (051) (Manga)" },
  { slug: "op-op09-051_p3", externalId: "671454", externalTitle: "Buggy - OP09-051 (SP)" },
  { slug: "op-op09-051_p4", externalId: "671453", externalTitle: "Buggy - OP09-051 (SP) (Gold)" },

  // 3. OP07-051 Boa Hancock
  { slug: "op-op07-051", externalId: "545839", externalTitle: "Boa Hancock (051) OP07-051" },
  { slug: "op-op07-051_p1", externalId: "545840", externalTitle: "Boa Hancock (051) (Parallel) OP07-051" },
  { slug: "op-op07-051_p2", externalId: "545841", externalTitle: "Boa Hancock (051) (Parallel) (Manga)" },
  { slug: "op-op07-051_p3", externalId: "596917", externalTitle: "Boa Hancock (SP) OP07-051" },
  // op-op07-051_p4 in op-569801 is English 2nd Anniversary promo
  { slug: "op-op07-051_p4", externalId: "635478", externalTitle: "Boa Hancock (051) (English Version 2nd Anniversary Set)" },

  // 4. OP01-001 Zoro
  { slug: "op-op01-001", externalId: "454512", externalTitle: "Roronoa Zoro (001) OP01-001" },
  { slug: "op-op01-001_p1", externalId: "454513", externalTitle: "Roronoa Zoro (001) (Parallel) OP01-001" },
  { slug: "op-op01-001_p2", externalId: "485262", externalTitle: "Roronoa Zoro - OP01-001 (Alternate Art)" },

  // 5. OP01-016 Nami
  { slug: "op-op01-016", externalId: "454534", externalTitle: "Nami OP01-016" },
  { slug: "op-op01-016_p1", externalId: "454536", externalTitle: "Nami (Parallel) OP01-016" },
  { slug: "op-op01-016_p2", externalId: "485265", externalTitle: "Nami - OP01-016 (Alternate Art)" },

  // 6. P-041 Monkey.D.Luffy
  { slug: "op-p-041", externalId: "531486", externalTitle: "Monkey.D.Luffy (041)" },
];

/**
 * Apply a list of verified card source mappings, move corrupted price data to quarantine,
 * and re-sync genuine dual-engine sales history.
 */
export async function applyMappingCorrections(corrections: ManualCorrection[]) {
  console.log(`Applying ${corrections.length} verified mapping corrections...`);

  for (const c of corrections) {
    const cardRes = await pool.query(`SELECT id, slug, name FROM cards WHERE slug = $1`, [c.slug]);
    const card = cardRes.rows[0];
    if (!card) {
      console.warn(`Card not found: ${c.slug}`);
      continue;
    }

    // Check existing mapping
    const curMap = await pool.query(
      `SELECT external_id, external_title FROM card_source_mapping WHERE card_id = $1 AND source = 'tcgplayer'`,
      [card.id]
    );

    const oldExtId = curMap.rows[0]?.external_id;
    const isChanged = oldExtId && oldExtId !== c.externalId.toString();

    // If external_id changed, migrate old price history into quarantine per Data Preservation Policy
    if (isChanged) {
      console.log(`[QUARANTINE MIGRATION] ${c.slug}: Moving old history from external_id ${oldExtId} to quarantine`);
      const oldHist = await pool.query(
        `SELECT * FROM price_history WHERE card_id = $1 AND source = 'tcgplayer'`,
        [card.id]
      );

      for (const r of oldHist.rows) {
        await pool.query(
          `
          INSERT INTO price_quarantine (
            card_id, source, grade, price, price_native, currency, price_kind, reason, evidence, observed_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual-mapping-correction', $8, $9)
          `,
          [
            r.card_id,
            r.source,
            r.grade,
            r.price,
            r.price_native,
            r.currency,
            r.price_kind,
            JSON.stringify({
              note: `Re-mapped from incorrect external_id ${oldExtId} to ${c.externalId}`,
              oldExtId,
              newExtId: c.externalId,
              originalRecordedAt: r.recorded_at,
            }),
            r.recorded_at,
          ]
        );
      }
      await pool.query(`DELETE FROM price_history WHERE card_id = $1 AND source = 'tcgplayer'`, [card.id]);
    }

    // Upsert correct source mapping with confirmed status
    await pool.query(
      `
      INSERT INTO card_source_mapping (
        card_id, source, external_id, external_url, external_title, confidence, matched_by, updated_at
      )
      VALUES ($1, 'tcgplayer', $2, $3, $4, 'confirmed', 'manual', NOW())
      ON CONFLICT (card_id, source)
      DO UPDATE SET external_id = EXCLUDED.external_id,
                    external_url = EXCLUDED.external_url,
                    external_title = EXCLUDED.external_title,
                    confidence = 'confirmed',
                    matched_by = 'manual',
                    updated_at = NOW()
      `,
      [card.id, c.externalId.toString(), `https://www.tcgplayer.com/product/${c.externalId}`, c.externalTitle]
    );

    // Run dual-engine sync to fetch 1Y history & latest sales
    const syncRes = await syncDualEngineSales(card.id, c.externalId);
    console.log(
      `[MAPPED & SYNCED] ${c.slug} -> Prod ${c.externalId} ("${c.externalTitle}"): Headline $${syncRes.finalPrice} (${syncRes.insertedHistoryCount} weekly points)`
    );
  }
}

/**
 * Automatically identifies remaining duplicate product mappings and resolves them.
 */
export async function resolveAllCollisions() {
  console.log("\nSearching for remaining duplicate product collisions across English catalog...");
  const dupes = await pool.query(`
    SELECT csm.external_id, csm.external_title, COUNT(*) as card_count,
           array_agg(c.id) as card_ids, array_agg(c.slug) as slugs, array_agg(c.name) as names
    FROM card_source_mapping csm
    JOIN cards c ON c.id = csm.card_id
    WHERE csm.source = 'tcgplayer' 
      AND c.slug LIKE 'op-%' AND c.slug NOT LIKE '%-ja'
    GROUP BY csm.external_id, csm.external_title
    HAVING COUNT(*) > 1;
  `);

  console.log(`Found ${dupes.rows.length} product collisions remaining.`);

  for (const group of dupes.rows) {
    const extId = group.external_id;
    const title = group.external_title || "";
    console.log(`\nInspecting collision for Prod ${extId} ("${title}") on cards: ${group.slugs.join(", ")}`);

    // Disambiguate based on set context and keywords
    for (let i = 0; i < group.slugs.length; i++) {
      const slug = group.slugs[i];
      const cardId = group.card_ids[i];
      const name = group.names[i];

      // If one card is in promotional set (op-569801 or op-569901) and product is from a regular booster set,
      // unbind the promo card so it doesn't steal the booster card's price
      const cardMeta = await pool.query(
        `SELECT s.slug as set_slug FROM cards c JOIN sets s ON s.id = c.set_id WHERE c.id = $1`,
        [cardId]
      );
      const setSlug = cardMeta.rows[0]?.set_slug;

      if ((setSlug === "op-569801" || setSlug === "op-569901") && !title.toLowerCase().includes("promo")) {
        console.log(`  -> Unlinking promo card ${slug} from booster product ${extId}`);
        await pool.query(
          `
          DELETE FROM card_source_mapping WHERE card_id = $1 AND source = 'tcgplayer'
          `,
          [cardId]
        );
        // Clear contaminated headline price
        await pool.query(
          `
          UPDATE card_price_current
          SET headline_cents = NULL, headline_source = NULL,
              source_prices = source_prices - 'tcgplayer',
              computed_at = NOW()
          WHERE card_id = $1 AND headline_source = 'tcgplayer'
          `,
          [cardId]
        );
        await pool.query(`UPDATE cards SET price_cache_ttl = NULL WHERE id = $1`, [cardId]);
      }
    }
  }
}

// CLI runner
if (import.meta.url === `file://${process.argv[1]}`) {
  async function run() {
    // 1. Apply primary manual corrections
    await applyMappingCorrections(PRIMARY_CORRECTIONS);

    // 2. Resolve remaining duplicate product collisions
    await resolveAllCollisions();

    // 3. Final verification of remaining duplicates
    const finalCheck = await pool.query(`
      SELECT csm.external_id, COUNT(*) as card_count
      FROM card_source_mapping csm
      JOIN cards c ON c.id = csm.card_id
      WHERE csm.source = 'tcgplayer' 
        AND c.slug LIKE 'op-%' AND c.slug NOT LIKE '%-ja'
      GROUP BY csm.external_id
      HAVING COUNT(*) > 1;
    `);

    console.log(`\nVerification: Remaining duplicate products in catalog: ${finalCheck.rows.length}`);
    process.exit(0);
  }

  run().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
