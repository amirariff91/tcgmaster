import { dbQuery } from "../lib/db/client";

interface SearchHit {
  productId: number;
  productName: string;
  cleanSetName?: string;
  marketPrice?: number;
  customAttributes?: {
    number?: string;
  };
}

async function searchTcgPlayer(cardName: string, cardNumber: string, setName: string): Promise<SearchHit | null> {
  const cleanNumber = cardNumber.replace(/^0+/, "");
  const query = `${cardName} ${cardNumber}`;

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

    if (!res.ok) return null;
    const data = await res.json();
    const hits: SearchHit[] = data.results?.[0]?.results || [];
    if (hits.length === 0) return null;

    for (const h of hits) {
      const hitNum = (h.customAttributes?.number || "").trim().toLowerCase();
      const targetNum = cardNumber.trim().toLowerCase();
      const targetClean = cleanNumber.trim().toLowerCase();

      if (
        hitNum === targetNum || 
        hitNum === targetClean ||
        hitNum.replace(/^0+/, "") === targetClean ||
        h.productName.toLowerCase().includes(targetNum)
      ) {
        return h;
      }
    }

    if (hits.length === 1) {
      const firstHit = hits[0];
      if (firstHit.productName.toLowerCase().includes(cardName.toLowerCase().split(" ")[0])) {
        return firstHit;
      }
    }

    return null;
  } catch (err: any) {
    console.warn(`[searchTcgPlayer] Error searching ${query}:`, err.message);
    return null;
  }
}

async function resolveSet(setId: string, setName: string, limit: number = 50) {
  console.log(`\n========================================`);
  console.log(`Starting resolution for set: "${setName}" (ID: ${setId})`);
  console.log(`========================================`);

  const cards = await dbQuery<{ id: string; name: string; number: string }>(`
    SELECT id, name, number
    FROM cards
    WHERE set_id = $1 AND tcg_player_id IS NULL
    ORDER BY number ASC
    LIMIT $2
  `, [setId, limit]);

  console.log(`Found ${cards.length} cards without tcg_player_id (batch limit: ${limit})`);

  let matched = 0;
  let skipped = 0;

  for (const card of cards) {
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

      console.log(`[MATCH] ${card.name} (#${card.number}) -> tcg_player_id: ${hit.productId} ("${hit.productName}", Market: $${hit.marketPrice ?? "N/A"})`);
      matched++;
    } else {
      console.log(`[MISS]  ${card.name} (#${card.number})`);
      skipped++;
    }

    await new Promise(r => setTimeout(r, 120));
  }

  console.log(`\nFinished "${setName}": ${matched} matched, ${skipped} missed.`);
}

async function main() {
  const targetSetId = process.argv[2] || "7218d6af-7ca4-495f-a46b-53598b773095"; // SWSH Black Star Promos
  const setInfo = await dbQuery<{ name: string }>(`SELECT name FROM sets WHERE id = $1`, [targetSetId]);
  const setName = setInfo[0]?.name || "Unknown Set";
  const limit = parseInt(process.argv[3] || "50", 10);

  await resolveSet(targetSetId, setName, limit);
}

main().catch(console.error);
