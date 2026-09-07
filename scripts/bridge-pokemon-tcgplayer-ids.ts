import { pool, dbQuery } from "../lib/db/client";

interface AggregationItem {
  urlValue: string;
  value: string;
  count: number;
}

interface TCGProduct {
  productId: number;
  productName: string;
  marketPrice?: number;
  customAttributes?: {
    number?: string;
    rarityDbName?: string;
  };
}

async function fetchAllTCGSets(): Promise<AggregationItem[]> {
  const payload = {
    algorithm: "",
    from: 0,
    size: 1,
    filters: {
      term: { productLineName: ["pokemon"] }
    },
    aggregations: ["setName"],
    settings: { useCategoryDefaultResultType: true }
  };

  const res = await fetch("https://mp-search-api.tcgplayer.com/v1/search/request?isList=true", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Failed to fetch TCG sets: ${res.status}`);
  const json = await res.json();
  return (json.results?.[0]?.aggregations?.setName || []) as AggregationItem[];
}

async function fetchProductsForSet(tcgSetName: string): Promise<TCGProduct[]> {
  const all: TCGProduct[] = [];
  let from = 0;
  const size = 50;

  while (true) {
    const payload = {
      algorithm: "",
      from,
      size,
      filters: {
        term: {
          productLineName: ["pokemon"],
          setName: [tcgSetName],
        }
      },
      settings: { useCategoryDefaultResultType: true }
    };

    const res = await fetch("https://mp-search-api.tcgplayer.com/v1/search/request?isList=true", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) break;
    const json = await res.json();
    const batch = (json.results?.[0]?.results || []) as TCGProduct[];
    if (batch.length === 0) break;
    all.push(...batch);

    from += size;
    const total = json.results?.[0]?.totalResults || 0;
    if (from >= total) break;
  }

  return all;
}

function cleanString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function findBestTCGSet(dbSetName: string, dbSlug: string, tcgSets: AggregationItem[]): string | null {
  const cleanDb = cleanString(dbSetName);

  // Exact cleaned match
  for (const s of tcgSets) {
    const cleanTcg = cleanString(s.value);
    if (cleanTcg === cleanDb || cleanTcg.includes(cleanDb) || cleanDb.includes(cleanTcg)) {
      return s.value;
    }
  }

  // Common aliases
  if (dbSetName === "Sword & Shield") return "SWSH01: Sword & Shield Base Set";
  if (dbSetName === "Sun & Moon") return "SM: Base Set";
  if (dbSetName === "Black & White") return "Black & White";
  if (dbSetName === "Diamond & Pearl") return "Diamond & Pearl";
  if (dbSetName === "SM Black Star Promos") return "SM Promos";
  if (dbSetName === "XY Black Star Promos") return "XY Promos";
  if (dbSetName === "Base Set 2") return "Base Set 2";
  if (dbSetName === "Team Rocket Returns") return "EX Team Rocket Returns";
  if (dbSetName === "Ruby & Sapphire") return "EX Ruby & Sapphire";

  return null;
}

export async function matchAndBridgeSet(dbSetId: string, dbSetName: string, tcgSetName: string) {
  console.log(`\n========================================`);
  console.log(`[Bridge] Bridging "${dbSetName}" -> TCGPlayer: "${tcgSetName}"`);
  console.log(`========================================`);

  const tcgProducts = await fetchProductsForSet(tcgSetName);
  console.log(`Fetched ${tcgProducts.length} products from TCGPlayer for "${tcgSetName}".`);

  const dbCards = await dbQuery<any>(`
    SELECT id, name, number, tcg_player_id
    FROM cards
    WHERE set_id = $1
  `, [dbSetId]);

  console.log(`Found ${dbCards.length} cards in DB for this set.`);

  let matchedCount = 0;
  for (const card of dbCards) {
    if (card.tcg_player_id) continue; // already has it

    const cNum = String(card.number || "").trim().replace(/^0+/, "");
    const cleanCardName = cleanString(card.name);

    // 1. Try matching by card number
    let match = tcgProducts.find(p => {
      const pRawNum = p.customAttributes?.number ? String(p.customAttributes.number) : "";
      const pNum = pRawNum.split("/")[0].trim().replace(/^0+/, "");
      return pNum && cNum && pNum === cNum;
    });

    // 2. If no number match, match by name
    if (!match) {
      match = tcgProducts.find(p => {
        const pClean = cleanString(p.productName);
        return pClean === cleanCardName;
      });
    }

    if (match) {
      const tcgId = match.productId;
      const tcgUrl = `https://www.tcgplayer.com/product/${tcgId}`;

      await dbQuery(`
        UPDATE cards
        SET tcg_player_id = $1,
            tcgplayer_url = COALESCE(tcgplayer_url, $2),
            updated_at = NOW()
        WHERE id = $3
      `, [tcgId, tcgUrl, card.id]);

      matchedCount++;
    }
  }

  console.log(`[Bridge] Successfully linked ${matchedCount} cards for "${dbSetName}"!`);
  return matchedCount;
}

async function main() {
  console.log("Starting automated TCGPlayer ID bridge for English Pokemon sets...");

  const tcgSets = await fetchAllTCGSets();
  console.log(`Fetched ${tcgSets.length} TCGPlayer Pokemon sets from catalog aggregation.`);

  // Get sets missing tcg_player_id
  const targetSets = await dbQuery<any>(`
    SELECT s.id, s.name, s.slug,
           COUNT(c.id) as total_cards,
           COUNT(c.tcg_player_id) as cards_with_tcg_id
    FROM sets s
    JOIN cards c ON c.set_id = s.id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = 'pokemon' AND s.slug NOT LIKE '%-ja%'
    GROUP BY s.id, s.name, s.slug
    HAVING COUNT(c.tcg_player_id) < COUNT(c.id)
    ORDER BY (COUNT(c.id) - COUNT(c.tcg_player_id)) DESC
    LIMIT 20
  `);

  let totalLinked = 0;

  for (const set of targetSets) {
    const matchedTcgSetName = findBestTCGSet(set.name, set.slug, tcgSets);
    if (!matchedTcgSetName) {
      console.warn(`[Skip] Could not find clear TCGPlayer set match for: "${set.name}" (${set.slug})`);
      continue;
    }

    try {
      const count = await matchAndBridgeSet(set.id, set.name, matchedTcgSetName);
      totalLinked += count;
    } catch (err: any) {
      console.error(`Error bridging set ${set.name}:`, err.message);
    }
  }

  console.log(`\n======================================================`);
  console.log(`Bridge complete! Total cards linked with TCGPlayer IDs: ${totalLinked}`);
  console.log(`======================================================`);
}

if (import.meta.main) {
  main().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
