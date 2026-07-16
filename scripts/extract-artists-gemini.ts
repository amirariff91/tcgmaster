import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// Load env automatically via bun
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini - Requires GEMINI_API_KEY in .env
if (!process.env.GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in .env file.");
  console.error("Please generate a free key from Google AI Studio and add it to .env");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// SAFE_MODE=1 → longer sleep between Gemini calls
const SAFE_MODE = process.env.SAFE_MODE === '1';
const SLEEP_MS = SAFE_MODE ? 15000 : 12000;

/**
 * Detect MIME type from HTTP Content-Type header.
 * Falls back to 'image/jpeg' if unknown — Gemini handles JPEG/PNG/WebP fine.
 * IMPORTANT: Do NOT hardcode 'image/png' — card images are typically JPEG.
 */
function detectMimeType(contentType: string | null): string {
  if (!contentType) return 'image/jpeg';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'image/jpeg';
  if (contentType.includes('png')) return 'image/png';
  if (contentType.includes('webp')) return 'image/webp';
  if (contentType.includes('gif')) return 'image/gif';
  return 'image/jpeg'; // safe default — Gemini handles it well
}

async function extractArtist(imageUrl: string): Promise<string | null> {
  let retries = 3;
  while (retries > 0) {
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error("Failed to download image");
      
      // Detect MIME type from actual response headers (fixes the image/png hardcode bug)
      const contentType = res.headers.get('content-type');
      const mimeType = detectMimeType(contentType);
      
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');
      
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: "This is a One Piece Trading Card Game card. The artist/illustrator name appears as **vertical text printed along the RIGHT edge** of the card (rotated 90°). Look specifically at the right-side border of the card. Return ONLY the artist's name (e.g. 'KOTORINA', 'Miki Takahashi', 'Eiichiro Oda'). If you cannot find any name, return 'Unknown'." },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              }
            ]
          }
        ]
      });
      
      const artist = response.text?.trim() || 'Unknown';
      return artist;
    } catch (error: any) {
      if (error?.message?.includes('429') || error?.status === 429) {
        console.log(`Rate limited! (${error?.message}) Waiting 15s before retry...`);
        await new Promise(r => setTimeout(r, 15000));
        retries--;
      } else {
        console.error("AI Extraction error:", error);
        return null;
      }
    }
  }
  return null;
}

async function run() {
  console.log(`Starting continuous background extraction for One Piece cards [SAFE_MODE=${SAFE_MODE}]...`);
  
  while (true) {
    console.log("Fetching next batch of cards missing artist data...");
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, name, image_url')
      .or('artist.is.null,artist.eq.Unknown')
      .like('slug', 'op-%')
      .not('slug', 'like', '%-ja')
      .not('image_url', 'is', null)
      .limit(100);
      
    if (error) {
      console.error("Failed to fetch cards", error);
      break;
    }
    
    if (!cards || cards.length === 0) {
      console.log("No more cards to process. All EN OP artists filled or marked Unknown!");
      console.log("Sleeping 5 minutes before checking for new cards...");
      await new Promise(r => setTimeout(r, 5 * 60 * 1000));
      continue; // Keep running as idle-loop, don't exit
    }
    
    console.log(`Found ${cards.length} cards to process.`);
    
    for (const card of cards) {
      console.log(`Processing ${card.name}...`);
      
      const artist = await extractArtist(card.image_url);
      
      if (artist === null) {
        console.log(`-> Extraction failed (likely rate limits). Skipping DB update and waiting 5 minutes...`);
        await new Promise(r => setTimeout(r, 5 * 60 * 1000));
        break; // Break the current batch to fetch again later
      }

      console.log(`-> Extracted Artist: ${artist}`);
      
      const { error: updateError } = await supabase
        .from('cards')
        .update({ artist: artist })
        .eq('id', card.id);
        
      if (updateError) {
        console.error(`Failed to update ${card.name}`, updateError);
      }
      
      // Sleep to respect Gemini rate limits (15 RPM free tier)
      console.log(`Sleeping ${SLEEP_MS / 1000}s for rate limits...`);
      await new Promise(r => setTimeout(r, SLEEP_MS));
    }
    
    console.log("Finished batch! Continuing to next batch...");
  }
}

run();
