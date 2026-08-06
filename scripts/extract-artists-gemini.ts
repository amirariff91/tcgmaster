import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SAFE_MODE = process.env.SAFE_MODE === '1';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY.");
  console.error("Create one at Google AI Studio and set GEMINI_API_KEY as documented in .env.example");
  process.exit(1);
}

// Rate limit sleep: 60s normal mode
const SLEEP_MS = SAFE_MODE ? 120000 : 60000;

// Supported active Google Gemini vision models in priority order
const MODEL_PRIORITY = [
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
];

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

async function askVisionModel(base64Data: string, mimeType: string): Promise<string> {
  let lastError = '';

  for (const modelName of MODEL_PRIORITY) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: ARTIST_PROMPT },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }]
        }),
      });

      if (res.status === 429) {
        console.warn(`  ! Model ${modelName} hit 429 rate limit. Trying next model...`);
        lastError = `429 Rate Limit on ${modelName}`;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        lastError = `${res.status} ${res.statusText}: ${body.slice(0, 150)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      return text.trim() || 'Unknown';
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}

function detectMimeType(contentType: string | null): string {
  if (!contentType) return 'image/jpeg';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'image/jpeg';
  if (contentType.includes('png')) return 'image/png';
  if (contentType.includes('webp')) return 'image/webp';
  if (contentType.includes('gif')) return 'image/gif';
  return 'image/jpeg';
}

async function extractArtist(imageUrl: string): Promise<string | null> {
  let retries = 3;
  while (retries > 0) {
    try {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        console.warn(`  ! Failed to download image: ${imgRes.status} ${imgRes.statusText}`);
        return null;
      }

      const mimeType = detectMimeType(imgRes.headers.get('content-type'));
      const arrayBuffer = await imgRes.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');

      return await askVisionModel(base64Data, mimeType);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`  ! Vision extraction attempt failed: ${message}. Retries left: ${retries - 1}`);
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }
  return null;
}

async function run() {
  console.log(`🤖 Starting Gemini Artist Vision Extraction Worker [SAFE_MODE=${SAFE_MODE}]...`);

  while (true) {
    try {
      // Find cards missing illustrator info (priority: Japanese One Piece first)
      const { data: cards, error } = await supabase
        .from('cards')
        .select('id, name, slug, image_url, local_image_url, illustrator')
        .is('illustrator', null)
        .like('slug', 'op-%-ja')
        .limit(1);

      let targetCard = cards?.[0];

      if (!targetCard) {
        const { data: generalCards } = await supabase
          .from('cards')
          .select('id, name, slug, image_url, local_image_url, illustrator')
          .is('illustrator', null)
          .limit(1);
        targetCard = generalCards?.[0];
      }

      if (!targetCard) {
        console.log("No cards pending artist extraction. Sleeping 10 minutes...");
        await new Promise((resolve) => setTimeout(resolve, 600000));
        continue;
      }

      const targetImageUrl = targetCard.local_image_url || targetCard.image_url;
      if (!targetImageUrl) {
        await supabase.from('cards').update({ illustrator: 'Unknown' }).eq('id', targetCard.id);
        continue;
      }

      console.log(`\nExtracting artist for ${targetCard.slug} (${targetCard.name})...`);
      const artist = await extractArtist(targetImageUrl);

      if (artist) {
        await supabase
          .from('cards')
          .update({ illustrator: artist, updated_at: new Date().toISOString() })
          .eq('id', targetCard.id);
        console.log(`  ✓ Successfully extracted artist for ${targetCard.slug}: "${artist}"`);
      } else {
        await supabase
          .from('cards')
          .update({ illustrator: 'Unknown', updated_at: new Date().toISOString() })
          .eq('id', targetCard.id);
        console.log(`  ! Extraction failed for ${targetCard.slug}. Set to "Unknown".`);
      }

      console.log(`Sleeping ${SLEEP_MS / 1000}s to respect Gemini API rate limits...`);
      await new Promise((resolve) => setTimeout(resolve, SLEEP_MS));
    } catch (loopErr: unknown) {
      const message = loopErr instanceof Error ? loopErr.message : String(loopErr);
      console.error("Unexpected worker loop error:", message);
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
  }
}

run().catch((err) => {
  console.error("Fatal Artist Vision worker error:", err);
  process.exit(1);
});
