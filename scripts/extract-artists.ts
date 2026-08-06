import 'dotenv/config';
import { dbQuery } from '../lib/db/client';

const SAFE_MODE = process.env.SAFE_MODE === '1';

// Uses the same Ollama Cloud vision API as lib/price-engine/image-matcher.ts
// (OLLAMA_API_KEY + OLLAMA_VISION_MODEL, default gemma4:31b). The key is already
// provisioned in the scrapers env.
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const OLLAMA_MODEL = process.env.OLLAMA_VISION_MODEL || 'gemma4:31b';
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'https://ollama.com';

if (!OLLAMA_API_KEY) {
  console.error("Missing OLLAMA_API_KEY.");
  console.error("Set OLLAMA_API_KEY (Ollama Cloud) in the scrapers app env as documented in .env.example");
  process.exit(1);
}

// Rate limit sleep: 60s normal mode
const SLEEP_MS = SAFE_MODE ? 120000 : 60000;

// Vision model is served by Ollama Cloud (OLLAMA_MODEL, default gemma4:31b).
// Same API shape as lib/price-engine/image-matcher.ts.

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

type ArtistCard = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  local_image_url: string | null;
  artist: string | null;
};

async function askVisionModel(base64Data: string, mimeType: string): Promise<string> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OLLAMA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [{
          role: 'user',
          content: ARTIST_PROMPT,
          images: [base64Data],
        }],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 150)}`);
    }

    const data = await res.json();
    const text = data?.message?.content ?? '';
    return text.trim() || 'Unknown';
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Ollama vision failed (${OLLAMA_MODEL}): ${message}`);
  }
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
      // Find cards missing artist info (priority: Japanese One Piece first)
      const cards = await dbQuery<ArtistCard>(`
        SELECT id, name, slug, image_url, local_image_url, artist
        FROM cards
        WHERE artist IS NULL
          AND slug LIKE $1
        LIMIT 1
      `, ['op-%-ja']);

      let targetCard = cards?.[0];

      if (!targetCard) {
        const generalCards = await dbQuery<ArtistCard>(`
          SELECT id, name, slug, image_url, local_image_url, artist
          FROM cards
          WHERE artist IS NULL
          LIMIT 1
        `);
        targetCard = generalCards[0];
      }

      if (!targetCard) {
        console.log("No cards pending artist extraction. Sleeping 10 minutes...");
        await new Promise((resolve) => setTimeout(resolve, 600000));
        continue;
      }

      const targetImageUrl = targetCard.local_image_url || targetCard.image_url;
      if (!targetImageUrl) {
        await dbQuery(
          `UPDATE cards SET artist = $1 WHERE id = $2`,
          ['Unknown', targetCard.id],
        );
        continue;
      }

      console.log(`\nExtracting artist for ${targetCard.slug} (${targetCard.name})...`);
      const artist = await extractArtist(targetImageUrl);

      if (artist) {
        await dbQuery(
          `UPDATE cards
           SET artist = $1, updated_at = $2
           WHERE id = $3`,
          [artist, new Date().toISOString(), targetCard.id],
        );
        console.log(`  ✓ Successfully extracted artist for ${targetCard.slug}: "${artist}"`);
      } else {
        await dbQuery(
          `UPDATE cards
           SET artist = $1, updated_at = $2
           WHERE id = $3`,
          ['Unknown', new Date().toISOString(), targetCard.id],
        );
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
