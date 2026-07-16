import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

async function askGemini(imageUrl: string, products: any[]) {
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

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
          ]
        }
      ]
    });
    
    const text = response.text?.trim();
    if (text && !isNaN(parseInt(text))) {
      return parseInt(text);
    }
    return null;
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429')) {
      console.log("Rate limited! Waiting 30s...");
      await new Promise(r => setTimeout(r, 30000));
    } else {
      console.error(error);
    }
    return null;
  }
}

async function run() {
  console.log("Starting AI Variant Mapping...");
  
  const { data: cards } = await supabase
    .from('cards')
    .select('id, slug, name, number, image_url')
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
    
    console.log(`-> Found ${products.length} possibilities. Asking Gemini...`);
    const matchedId = await askGemini(card.image_url, products);
    
    if (matchedId) {
      console.log(`-> Gemini matched ${card.slug} to TCGPlayer ID ${matchedId} (${products.find(p=>p.productId===matchedId)?.name})`);
      dict[card.slug] = matchedId;
      newMappings++;
      saveDict(dict); // Save immediately
    } else {
      console.log(`-> Gemini failed to match.`);
    }
    
    await new Promise(r => setTimeout(r, 12000)); // Sleep 12s to respect limits
  }

  console.log(`Finished mapping! Added ${newMappings} new mappings.`);
}

run();
