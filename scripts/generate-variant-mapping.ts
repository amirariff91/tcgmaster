import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL || 'gemma4:31b';
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com';

if (!OLLAMA_API_KEY) {
  console.error("Missing OLLAMA_API_KEY.");
  process.exit(1);
}
const CATEGORY_ID = 68; // One Piece

let cachedGroups: any[] | null = null;
const cachedProducts: Record<number, any[]> = {};

async function getGroups() {
  if (cachedGroups) return cachedGroups;
  const res = await fetch(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/groups`, { headers: { 'User-Agent': 'curl/8.4.0' } });
  cachedGroups = (await res.json()).results || [];
  return cachedGroups;
}

async function getProducts(groupId: number) {
  if (cachedProducts[groupId]) return cachedProducts[groupId];
  const res = await fetch(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/${groupId}/products`, { headers: { 'User-Agent': 'curl/8.4.0' } });
  cachedProducts[groupId] = (await res.json()).results || [];
  return cachedProducts[groupId];
}

async function findTcgProductsForNumber(baseNumber: string) {
  const groups = await getGroups();
  let matches: any[] = [];
  // Brute force all groups since we just need to find the products
  for (const g of groups) {
    const products = await getProducts(g.groupId);
    const m = products.filter((p: any) => p.extendedData?.find((d: any) => d.name === 'Number')?.value === baseNumber);
    if (m.length > 0) matches.push(...m);
  }
  return matches;
}

const dictPath = path.resolve(process.cwd(), 'lib/price-engine/mapping-dictionary.json');

function loadDict() {
  try {
    return JSON.parse(fs.readFileSync(dictPath, 'utf8'));
  } catch {
    return {};
  }
}

function saveDict(dict: any) {
  fs.writeFileSync(dictPath, JSON.stringify(dict, null, 2));
}

async function askOllama(imageUrl: string, products: any[]) {
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
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [{ role: 'user', content: prompt, images: [base64Data] }],
      }),
    });

    if (!chatRes.ok) {
      console.error(`Ollama Error: ${chatRes.statusText}`);
      return null;
    }

    const data = await chatRes.json();
    const text = (data?.message?.content ?? '').trim();
    
    if (text && !isNaN(parseInt(text))) {
      return parseInt(text);
    }
    return null;
  } catch (error: any) {
    console.error("AI Mapping error:", error);
    return null;
  }
}

async function run() {
  console.log("Starting AI Variant Mapping...");
  
  const { data: cards } = await supabase
    .from('cards')
    .select('id, slug, name, number, image_url, local_image_url')
    .like('slug', 'op-%_%') // Only variants
    .not('slug', 'like', '%-ja') // Exclude Japanese cards
    .limit(300);

  if (!cards || cards.length === 0) {
    console.log("No English variants need mapping right now.");
    return;
  }

  const dict = loadDict();
  let newMappings = 0;

  for (const card of cards) {
    if (dict[card.slug]) continue; // Already mapped
    
    console.log(`Processing ${card.slug}...`);
    const baseNumber = card.number; // e.g. OP13-118
    const products = await findTcgProductsForNumber(baseNumber);
    
    if (products.length === 0) {
      console.log(`-> No TCGPlayer products found for ${baseNumber}`);
      continue;
    }
    
    if (products.length === 1) {
      console.log(`-> Auto-mapped ${card.slug} to ${products[0].productId}`);
      dict[card.slug] = products[0].productId;
      newMappings++;
      continue;
    }
    
    console.log(`-> Found ${products.length} possibilities. Asking Ollama...`);
    const targetImageUrl = card.local_image_url || card.image_url;
    const matchedId = await askOllama(targetImageUrl, products);
    
    if (matchedId) {
      console.log(`-> Ollama matched ${card.slug} to TCGPlayer ID ${matchedId} (${products.find(p=>p.productId===matchedId)?.name})`);
      dict[card.slug] = matchedId;
      newMappings++;
      saveDict(dict); // Save immediately
    } else {
      console.log(`-> Ollama failed to match. Marking as -1 to prevent infinite retries.`);
      dict[card.slug] = -1; // -1 indicates it was processed but could not be confidently matched
      saveDict(dict);
    }
    
    await new Promise(r => setTimeout(r, 12000)); // Sleep 12s to respect limits
  }

  console.log(`Finished mapping! Added ${newMappings} new mappings.`);
}

run();
