import 'dotenv/config';
import { dbQuery } from '../lib/db/client';
import fs from 'fs';
import path from 'path';

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL || 'gemma4:31b';
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com';

const HEADERS = { 'User-Agent': 'TCGMaster/1.0.0' };
const CATEGORY_ID = 68; // One Piece

let cachedGroups: any[] | null = null;
const cachedProducts: Record<number, any[]> = {};

/**
 * Clean card number to isolate the base set number for TCGPlayer lookup.
 * E.g., "OP10-022_p1" -> "OP10-022", "ST12-008_r1" -> "ST12-008"
 */
function cleanBaseNumber(rawNumber: string): string {
  if (!rawNumber) return '';
  // Split on underscore to remove variant/parallel suffixes (_p1, _r1, etc.)
  const base = rawNumber.split('_')[0].trim().toUpperCase();
  return base;
}

async function getGroups() {
  if (cachedGroups) return cachedGroups;
  try {
    const res = await fetch(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/groups`, { headers: HEADERS });
    if (!res.ok) return [];
    cachedGroups = (await res.json()).results || [];
    return cachedGroups;
  } catch {
    return [];
  }
}

async function getProducts(groupId: number) {
  if (cachedProducts[groupId]) return cachedProducts[groupId];
  try {
    const res = await fetch(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/${groupId}/products`, { headers: HEADERS });
    if (!res.ok) return [];
    cachedProducts[groupId] = (await res.json()).results || [];
    return cachedProducts[groupId];
  } catch {
    return [];
  }
}

async function findTcgProductsForNumber(rawNumber: string) {
  const baseNumber = cleanBaseNumber(rawNumber);
  if (!baseNumber) return [];

  const groups = (await getGroups()) || [];
  const matches: any[] = [];

  for (const g of groups) {
    const products = await getProducts(g.groupId);
    const m = products.filter((p: any) => {
      const numVal = p.extendedData?.find((d: any) => d.name === 'Number')?.value;
      return numVal && numVal.toUpperCase() === baseNumber;
    });
    if (m.length > 0) matches.push(...m);
  }
  return matches;
}

const dictPath = path.resolve(process.cwd(), 'lib/price-engine/mapping-dictionary.json');

function loadDict(): Record<string, number> {
  try {
    const data = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
    // Flush any stale -1 markers so they get re-evaluated cleanly
    for (const key of Object.keys(data)) {
      if (data[key] === -1) {
        delete data[key];
      }
    }
    return data;
  } catch {
    return {};
  }
}

function saveDict(dict: Record<string, number>) {
  fs.writeFileSync(dictPath, JSON.stringify(dict, null, 2));
}

async function askOllama(imageUrl: string, products: any[]) {
  if (!OLLAMA_API_KEY) return null;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    const prompt = `This is a One Piece Trading Card Game card variant. I need to map it to the exact TCGPlayer product ID.
Here are the possible matches from TCGPlayer:
${products.map(p => `- ID: ${p.productId}, Name: "${p.name}"`).join('\n')}

Look closely at the image (is it Manga, Alternate Art, Wanted, SP, Gold?). Pick the ONE product ID that corresponds perfectly to this card variant.
Return ONLY the numeric product ID. If none match or you are unsure, return "Unknown".`;

    const chatRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OLLAMA_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'TCGMaster/1.0.0',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [{ role: 'user', content: prompt, images: [base64Data] }],
      }),
    });

    if (!chatRes.ok) {
      return null;
    }

    const data = await chatRes.json();
    const text = (data?.message?.content ?? '').trim();

    if (text && !isNaN(parseInt(text))) {
      return parseInt(text);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch cards ordered by highest price history first
 */
async function fetchCardsByPhase(phaseFilter: string): Promise<any[]> {
  // Query price_history to order by highest price descending
  const topPrices = await dbQuery<{ card_id: string; price: number }>(`
    SELECT card_id, price::double precision AS price
    FROM price_history
    ORDER BY price DESC
    LIMIT 1000
  `);

  const priceMap = new Map<string, number>();
  for (const p of topPrices) {
    if (!priceMap.has(p.card_id) || p.price > priceMap.get(p.card_id)!) {
      priceMap.set(p.card_id, p.price || 0);
    }
  }

  let whereClause = '';
  const params: string[] = [];

  if (phaseFilter === 'jp-one-piece') {
    whereClause = 'WHERE slug LIKE $1 AND slug LIKE $2';
    params.push('op-%', '%-ja');
  } else if (phaseFilter === 'en-one-piece') {
    whereClause = 'WHERE slug LIKE $1 AND slug NOT LIKE $2';
    params.push('op-%', '%-ja');
  } else if (phaseFilter === 'dbfw') {
    whereClause = 'WHERE slug LIKE $1';
    params.push('dbfw-%');
  }

  const cards = await dbQuery<{
    id: string;
    slug: string;
    name: string;
    number: string;
    image_url: string | null;
    local_image_url: string | null;
  }>(`
    SELECT id, slug, name, number, image_url, local_image_url
    FROM cards
    ${whereClause}
    LIMIT 500
  `, params);

  // Sort cards by highest price first
  cards.sort((a, b) => {
    const priceA = priceMap.get(a.id) || 0;
    const priceB = priceMap.get(b.id) || 0;
    return priceB - priceA;
  });

  return cards;
}

async function runPhase(phaseName: string, phaseFilter: string, dict: Record<string, number>): Promise<number> {
  console.log(`\n=================================================================`);
  console.log(`🚀 Starting ${phaseName} Mapping (Highest Price First)...`);
  console.log(`=================================================================`);

  const cards = await fetchCardsByPhase(phaseFilter);
  if (cards.length === 0) {
    console.log(`No cards found for ${phaseName}.`);
    return 0;
  }

  console.log(`Found ${cards.length} cards in ${phaseName} queue.`);
  let newMappings = 0;

  for (const card of cards) {
    if (dict[card.slug]) continue; // Already mapped

    const baseNumber = cleanBaseNumber(card.number);
    console.log(`\nProcessing ${card.slug} (Base Number: ${baseNumber})...`);

    const products = await findTcgProductsForNumber(card.number);

    if (products.length === 0) {
      console.log(`-> No TCGPlayer products found for base number "${baseNumber}"`);
      continue;
    }

    if (products.length === 1) {
      console.log(`-> Auto-mapped ${card.slug} to TCGPlayer ID ${products[0].productId} (${products[0].name})`);
      dict[card.slug] = products[0].productId;
      newMappings++;
      saveDict(dict);
      continue;
    }

    // Multiple products found — check for Parallel / Alternate Art match
    const parallelMatch = products.find((p: any) => {
      const n = (p.name || '').toLowerCase();
      return n.includes('parallel') || n.includes('alternate art') || n.includes('manga') || n.includes('special card');
    });

    if (parallelMatch && products.length === 2) {
      console.log(`-> Auto-matched parallel variant ${card.slug} to TCGPlayer ID ${parallelMatch.productId} (${parallelMatch.name})`);
      dict[card.slug] = parallelMatch.productId;
      newMappings++;
      saveDict(dict);
      continue;
    }

    console.log(`-> Found ${products.length} possibilities. Asking Ollama Cloud Vision...`);
    const targetImageUrl = card.local_image_url || card.image_url;
    const matchedId = await askOllama(targetImageUrl, products);

    if (matchedId) {
      console.log(`-> Ollama matched ${card.slug} to TCGPlayer ID ${matchedId}`);
      dict[card.slug] = matchedId;
      newMappings++;
      saveDict(dict);
    } else if (parallelMatch) {
      console.log(`-> Ollama unsure. Falling back to parallel match ${parallelMatch.productId}`);
      dict[card.slug] = parallelMatch.productId;
      newMappings++;
      saveDict(dict);
    } else {
      console.log(`-> Marking ${card.slug} as unmatched (-1)`);
      dict[card.slug] = -1;
      saveDict(dict);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`Finished ${phaseName}! Added ${newMappings} new mappings.`);
  return newMappings;
}

async function run() {
  console.log("🤖 Starting AI Variant Mapping Engine (Continuous Priority: Japanese One Piece -> Expensive First)...");

  while (true) {
    const dict = loadDict();

    // Priority Focus: Japanese One Piece (highest price first)
    await runPhase("Priority Phase: Japanese One Piece (Expensive First)", "jp-one-piece", dict);

    console.log("\nJapanese One Piece Audit pass complete! Recirculating to highest price Japanese cards in 10 seconds...");
    await new Promise(r => setTimeout(r, 10000));
  }
}

run().catch(err => {
  console.error("Fatal Variant Mapper error:", err);
  process.exit(1);
});
