import { dbQuery } from "../lib/db/client";
import { syncDualEngineSales } from "./sync-tcgplayer-dual-engine";

interface SearchHit {
  productId: number;
  productName: string;
  cleanSetName?: string;
  marketPrice?: number;
  customAttributes?: {
    number?: string;
  };
}

async function executeSearch(query: string): Promise<SearchHit[]> {
  try {
    const res = await fetch("https://mp-search-api.tcgplayer.com/v1/search/request?q=" + encodeURIComponent(query) + "&isList=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({
        algorithm: "",
        from: 0,
        size: 5,
        filters: { term: { productLineName: ["pokemon"] } },
        listingSearch: { context: { cart: {} }, filters: { term: {}, range: {}, exclude: {} } },
        context: { cart: {} },
        settings: { useSeamless: true },
        sort: {}
      })
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.results?.[0]?.results || [];
  } catch {
    return [];
  }
}

async function searchTcgPlayer(cardName: string, cardNumber: string, setName: string): Promise<SearchHit | null> {
  const cleanNumber = cardNumber.replace(/^0+/, "").trim().toLowerCase();
  const targetNum = cardNumber.trim().toLowerCase();

  // Try 1: Name + Number
  let hits = await executeSearch(`${cardName} ${cardNumber}`);

  // Try 2: If no hits, fallback to Name + Set Name (e.g. Prismatic Evolutions)
  if (hits.length === 0) {
    const cleanSetName = setName.replace(/^pokemon\s+/i, "").trim();
    hits = await executeSearch(`${cardName} ${cleanSetName}`);
  }

  if (hits.length === 0) return null;

  for (const h of hits) {
    const rawHitNum = (h.customAttributes?.number || "").trim().toLowerCase();
    const hitNumSlash = rawHitNum.split("/")[0].replace(/^0+/, "");
    const cleanHitNum = rawHitNum.replace(/^0+/, "");

    if (
      rawHitNum === targetNum || 
      cleanHitNum === cleanNumber ||
      hitNumSlash === cleanNumber ||
      h.productName.toLowerCase().includes(` ${cleanNumber}/`) ||
      h.productName.toLowerCase().includes(`-${cleanNumber}/`) ||
      h.productName.toLowerCase().includes(` #${cleanNumber}`)
    ) {
      return h;
    }
  }

  return null;
}

export async function resolveAndSyncSet(setId: string, setName: string, syncPrices: boolean = true) {
  console.log(`\n============================================================`);
  console.log(`Resolving & Syncing Set: "${setName}" (ID: ${setId})`);
  console.log(`============================================================`);

  const cards = await dbQuery<{ id: string; name: string; number: string; tcg_player_id: string | null }>(`
    SELECT id, name, number, tcg_player_id
    FROM cards
    WHERE set_id = $1 AND tcg_player_id IS NULL
    ORDER BY number ASC
  `, [setId]);

  console.log(`Cards requiring tcg_player_id: ${cards.length}`);

  let matched = 0;
  let skipped = 0;
  let syncedPrices = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const hit = await searchTcgPlayer(card.name, card.number, setName);

    if (hit && hit.productId) {
      await dbQuery(`
        UPDATE cards
        SET tcg_player_id = $1,
            tcgplayer_url = COALESCE(tcgplayer_url, $2)
        WHERE id = $3
      `, [
        hit.productId.toString(),
        `https://www.tcgplayer.com/product/${hit.productId}`,
        card.id
      ]);

      matched++;
      process.stdout.write(`[${i + 1}/${cards.length}] [MATCH] ${card.name} (#${card.number}) -> ID: ${hit.productId}`);

      if (syncPrices) {
        try {
          const syncResult = await syncDualEngineSales(card.id, hit.productId);
          syncedPrices++;
          console.log(` | Market: $${syncResult.finalPrice ?? "N/A"} (${syncResult.insertedHistoryCount} history pts)`);
        } catch (e: any) {
          console.log(` | Price sync err: ${e.message}`);
        }
      } else {
        console.log("");
      }
    } else {
      skipped++;
      console.log(`[${i + 1}/${cards.length}] [MISS]  ${card.name} (#${card.number})`);
    }

    // Gentle pacing to avoid any rate limiting
    await new Promise(r => setTimeout(r, 120));
  }

  console.log(`\nSummary for "${setName}": ${matched} matched, ${skipped} skipped, ${syncedPrices} price records synced.`);
}

async function main() {
  const targetSetId = process.argv[2];
  const syncPrices = process.argv[3] !== "--no-prices";

  if (targetSetId) {
    const setInfo = await dbQuery<{ name: string }>(`SELECT name FROM sets WHERE id = $1`, [targetSetId]);
    if (setInfo.length === 0) {
      console.error(`Set ID ${targetSetId} not found.`);
      return;
    }
    await resolveAndSyncSet(targetSetId, setInfo[0].name, syncPrices);
  } else {
    // Run for top unmapped sets
    const sets = await dbQuery<{ set_id: string; set_name: string; missing_count: number }>(`
      SELECT 
        s.id as set_id,
        s.name as set_name,
        COUNT(c.id) FILTER (WHERE c.tcg_player_id IS NULL) as missing_count
      FROM sets s
      JOIN cards c ON c.set_id = s.id
      WHERE s.game_id = '18653911-4af3-4697-8fab-93b9c73aa97d'
      GROUP BY s.id, s.name
      HAVING COUNT(c.id) FILTER (WHERE c.tcg_player_id IS NULL) > 0
      ORDER BY COUNT(c.id) FILTER (WHERE c.tcg_player_id IS NULL) DESC
      LIMIT 10
    `);

    console.log(`Processing top ${sets.length} unmapped Pokémon sets...`);
    for (const set of sets) {
      await resolveAndSyncSet(set.set_id, set.set_name, syncPrices);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
