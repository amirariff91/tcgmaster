import { createClient } from '@supabase/supabase-js';

// Load env automatically via bun
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Vision model runs on Ollama Cloud rather than Gemini — same job, one less vendor,
// and it reads these cards at least as accurately (verified against known-artist cards).
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL || 'gemma4:31b';
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com';

if (!OLLAMA_API_KEY) {
  console.error("Missing OLLAMA_API_KEY.");
  console.error("Create one at https://ollama.com/settings/keys and set OLLAMA_API_KEY.");
  process.exit(1);
}

// SAFE_MODE=1 → longer sleep between vision calls
const SAFE_MODE = process.env.SAFE_MODE === '1';
const SLEEP_MS = SAFE_MODE ? 15000 : 12000;

// Every OP card carries a copyright strip (e.g. "©E.O/S., T.A. BANDAI MADE IN JAPAN")
// on the same edge as the artist credit. Cards WITHOUT a credit make vision models read
// that strip as a name — Gemini turned "©E.O" into "Eiichiro Oda". Name the trap so the
// model returns Unknown instead of inventing an artist.
const ARTIST_PROMPT = [
  "This is a One Piece Trading Card Game card. The artist/illustrator name, when present,",
  "appears as vertical text along the RIGHT edge of the card (rotated 90°).",
  "",
  "Return ONLY the artist's name (e.g. 'KOTORINA', 'phima', 'ASAKI KURODA').",
  "",
  "Return exactly 'Unknown' if there is no artist credit. Do NOT return any of the following,",
  "which are copyright/publisher text and are NOT artists:",
  "  - anything containing (c), ©, 'E.O', 'S.', 'T.A.', 'BANDAI', 'MADE IN JAPAN', 'EN'",
  "  - 'Eiichiro Oda' unless it is clearly printed as the illustrator credit itself",
  "If the only text you can see on that edge is the copyright line, return 'Unknown'.",
].join('\n');

async function askVisionModel(base64Data: string, _mimeType: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OLLAMA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [{ role: 'user', content: ARTIST_PROMPT, images: [base64Data] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data?.message?.content ?? '').trim() || 'Unknown';
}

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
      
      const artist = await askVisionModel(base64Data, mimeType);
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
