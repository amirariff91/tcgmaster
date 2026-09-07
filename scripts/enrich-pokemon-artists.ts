import { dbQuery } from "../lib/db/client";
import { slugifyArtist } from "../lib/artists/service";

interface BulbapediaParseResponse {
  parse?: {
    title: string;
    wikitext?: {
      "*": string;
    };
  };
}

interface ImageInfoResponse {
  query?: {
    pages: Record<string, {
      title: string;
      imageinfo?: Array<{ url: string }>;
    }>;
  };
}

const USER_AGENT = "TCGMaster-ArtistEnricher/1.0 (contact@tcgmaster.com)";

function cleanWikitext(text: string): string {
  return text
    .replace(/<ref[^>]*>.*?<\/ref>/gis, "")
    .replace(/<ref[^>]*\/>/gis, "")
    .replace(/\{\{wp\|([^}|]+)(?:\|([^}]+))?\}\}/g, "$2" || "$1")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/\[\[(?:File|Image):[^\]]+\]\]/gi, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<!--.*?-->/gs, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchImageDirectUrl(filename: string): Promise<string | null> {
  try {
    const norm = filename.replace(/ /g, "_");
    const url = `https://bulbapedia.bulbagarden.net/w/api.php?action=query&titles=File:${encodeURIComponent(norm)}&prop=imageinfo&iiprop=url&format=json`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const json = (await res.json()) as ImageInfoResponse;
    const page = Object.values(json.query?.pages || {})[0];
    return page?.imageinfo?.[0]?.url || null;
  } catch {
    return null;
  }
}

async function enrichPokemonArtist(artistName: string): Promise<boolean> {
  const wikiPage = artistName.replace(/ /g, "_");
  const url = `https://bulbapedia.bulbagarden.net/w/api.php?action=parse&page=${encodeURIComponent(wikiPage)}&prop=wikitext&format=json`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return false;
    const json = (await res.json()) as BulbapediaParseResponse;
    const wt = json.parse?.wikitext?.["*"];
    if (!wt) return false;

    // 1. Extract Japanese Kanji name
    const jpMatch = wt.match(/Japanese:\s*'''?([^'’\n]+)'''?/i);
    let japaneseName = jpMatch ? jpMatch[1].trim() : null;
    if (japaneseName) {
      japaneseName = japaneseName
        .replace(/\{\{(?:ruby|tt)\|([^}|]+)\|[^}]+\}\}/g, '$1')
        .replace(/\{\{[^}]+\}\}/g, '')
        .replace(/'''?/g, '')
        .trim();
    }

    // 2. Extract Birth year / details
    const birthMatch = wt.match(/born\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}|\d{4})/i);
    const birthYear = birthMatch ? birthMatch[1].trim() : null;

    // 3. Extract Avatar Image filename
    const imgMatch = wt.match(/\[\[(?:File|Image):([^|\]]+)/i);
    let avatarUrl: string | null = null;
    if (imgMatch && !imgMatch[1].toLowerCase().includes("card") && !imgMatch[1].toLowerCase().includes("logo")) {
      avatarUrl = await fetchImageDirectUrl(imgMatch[1].trim());
    }

    // 4. Extract Social Links (Twitter / website)
    const socialLinks: Record<string, string> = {};
    const twitterMatch = wt.match(/https?:\/\/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/i);
    if (twitterMatch) {
      socialLinks.twitter = `https://x.com/${twitterMatch[1]}`;
    }
    const webMatch = wt.match(/\[(https?:\/\/[^\s\]]+)\s+(?:Official|Personal|Website|Portfolio)/i);
    if (webMatch) {
      socialLinks.website = webMatch[1];
    }

    // 5. Clean up lead paragraph for Bio
    const paragraphs = wt.split(/\n\n+/);
    let leadBio = "";
    for (const p of paragraphs) {
      if (p.includes("'''" + artistName) || p.includes("'''") && p.includes("illustrator")) {
        leadBio = cleanWikitext(p);
        break;
      }
    }
    if (!leadBio && paragraphs.length > 0) {
      leadBio = cleanWikitext(paragraphs[0]);
    }

    // Keep bio punchy
    if (leadBio.length > 500) {
      leadBio = leadBio.substring(0, 497) + "...";
    }

    // 6. Role derivation
    let role = "TCG Illustrator";
    if (wt.toLowerCase().includes("manga artist")) {
      role = "Manga Artist & Illustrator";
    } else if (wt.toLowerCase().includes("character designer") || wt.toLowerCase().includes("art director")) {
      role = "Character Designer & Art Director";
    } else if (wt.toLowerCase().includes("clay") || wt.toLowerCase().includes("model")) {
      role = "Clay Sculptor & Photographer";
    } else if (wt.toLowerCase().includes("3d") || wt.toLowerCase().includes("cgi")) {
      role = "3D / CGI Illustrator";
    }

    const slug = slugifyArtist(artistName);

    // Upsert into PostgreSQL
    await dbQuery(`
      INSERT INTO artist_profiles (
        slug, display_name, japanese_name, role, country, birth_year, bio, avatar_url, social_links, games_illustrated, is_verified, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'Japan', $5, $6, $7, $8::jsonb, ARRAY['pokemon'], true, NOW()
      )
      ON CONFLICT (slug) DO UPDATE SET
        japanese_name = COALESCE(EXCLUDED.japanese_name, artist_profiles.japanese_name),
        role = COALESCE(EXCLUDED.role, artist_profiles.role),
        birth_year = COALESCE(EXCLUDED.birth_year, artist_profiles.birth_year),
        bio = COALESCE(EXCLUDED.bio, artist_profiles.bio),
        avatar_url = COALESCE(EXCLUDED.avatar_url, artist_profiles.avatar_url),
        social_links = artist_profiles.social_links || EXCLUDED.social_links,
        games_illustrated = ARRAY(SELECT DISTINCT unnest(artist_profiles.games_illustrated || EXCLUDED.games_illustrated)),
        updated_at = NOW();
    `, [slug, artistName, japaneseName, role, birthYear, leadBio, avatarUrl, JSON.stringify(socialLinks)]);

    console.log(`[SAVED] ${artistName} -> Kanji: ${japaneseName || "N/A"} | Birth: ${birthYear || "N/A"} | Avatar: ${avatarUrl ? "YES" : "NO"}`);
    return true;
  } catch (err) {
    console.error(`Error enriching ${artistName}:`, err);
    return false;
  }
}

async function main() {
  console.log("================================================================");
  console.log("Enriching Pokémon Illustrators from Bulbapedia MediaWiki API");
  console.log("================================================================\n");

  const topArtists = await dbQuery<{ artist: string; card_count: string }>(`
    SELECT c.artist, COUNT(c.id) as card_count
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = 'pokemon'
      AND c.artist IS NOT NULL 
      AND c.artist != '' 
      AND c.artist != 'Unknown'
    GROUP BY c.artist
    HAVING COUNT(c.id) >= 5
    ORDER BY COUNT(c.id) DESC
  `);

  console.log(`Found ${topArtists.length} prominent Pokémon artists to enrich.`);

  let enrichedCount = 0;
  for (let i = 0; i < topArtists.length; i++) {
    const a = topArtists[i];
    process.stdout.write(`[${i + 1}/${topArtists.length}] Processing ${a.artist} (${a.card_count} cards)... `);
    const ok = await enrichPokemonArtist(a.artist);
    if (ok) enrichedCount++;
    await new Promise(r => setTimeout(r, 200)); // Polite pacing
  }

  console.log(`\nDone! Successfully enriched ${enrichedCount} of ${topArtists.length} artists into PostgreSQL.`);
}

main().catch(console.error);
