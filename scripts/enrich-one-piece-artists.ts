import { dbQuery } from "../lib/db/client";
import { slugifyArtist } from "../lib/artists/service";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface DuckSearchResult {
  title: string;
  snippet: string;
  url: string;
}

async function searchDuckDuckGo(query: string): Promise<DuckSearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT }
    });
    if (!res.ok) return [];
    const html = await res.text();

    const results: DuckSearchResult[] = [];
    const snippetRegex = /<a class="result__snippet"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;
    let match: RegExpExecArray | null;

    while ((match = snippetRegex.exec(html)) !== null) {
      let rawHref = match[1];
      const snippet = match[2].replace(/<[^>]+>/g, "").trim();

      // Extract actual URL from DDG redirect wrapper
      const uddgMatch = rawHref.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        rawHref = decodeURIComponent(uddgMatch[1]);
      }

      results.push({
        title: "",
        snippet,
        url: rawHref
      });
    }

    return results;
  } catch {
    return [];
  }
}

async function enrichOnePieceArtist(artistName: string): Promise<boolean> {
  const slug = slugifyArtist(artistName);

  // Search for illustrator professional profiles (Twitter/X, Pixiv, Tumblr, Portfolio)
  const q = `site:x.com "${artistName}" イラストレーター OR "ONE PIECE" OR TCG`;
  const hits = await searchDuckDuckGo(q);

  let twitterUrl: string | null = null;
  let bioSummary: string | null = null;
  let portfolioUrl: string | null = null;

  for (const h of hits) {
    if (h.url.includes("x.com/") || h.url.includes("twitter.com/")) {
      const parts = h.url.split("/");
      const handle = parts[parts.length - 1];
      if (handle && !handle.includes("status") && !handle.includes("search") && !handle.includes("hashtag") && !handle.includes("i/")) {
        twitterUrl = `https://x.com/${handle}`;
        if (h.snippet && h.snippet.length > 20) {
          bioSummary = h.snippet;
        }
        break;
      }
    }
  }

  // If no bio found from twitter search, do a broader portfolio search
  if (!bioSummary) {
    const qBroader = `"${artistName}" イラストレーター ワンピース カード プロフィール`;
    const broadHits = await searchDuckDuckGo(qBroader);
    if (broadHits.length > 0 && broadHits[0].snippet) {
      bioSummary = broadHits[0].snippet;
    }
  }

  // Parse portfolio links from snippet
  if (bioSummary) {
    const blogMatch = bioSummary.match(/([a-zA-Z0-9_-]+\.(?:tumblr\.com|pixiv\.net|fanbox\.cc|foriio\.com|lit\.link))/);
    if (blogMatch) {
      portfolioUrl = `https://${blogMatch[1]}`;
    }
  }

  const socialLinks: Record<string, string> = {};
  if (twitterUrl) socialLinks.twitter = twitterUrl;
  if (portfolioUrl) socialLinks.portfolio = portfolioUrl;

  let role = "One Piece Card Game Illustrator";
  if (bioSummary?.includes("マンガ") || bioSummary?.includes("漫画")) {
    role = "Manga Artist & TCG Illustrator";
  } else if (bioSummary?.includes("コンセプトアート") || bioSummary?.includes("キャラクターデザイン")) {
    role = "Concept Artist & Character Designer";
  } else if (bioSummary?.includes("アニメ")) {
    role = "Anime Animator & Illustrator";
  }

  const cleanBio = bioSummary 
    ? `${artistName} is a professional commercial illustrator known for their dynamic artworks in the ONE PIECE Card Game. ${bioSummary}`
    : `${artistName} is an illustrator contributing official card artwork for the ONE PIECE Card Game.`;

  await dbQuery(`
    INSERT INTO artist_profiles (
      slug, display_name, role, country, bio, social_links, games_illustrated, is_verified, updated_at
    ) VALUES (
      $1, $2, $3, 'Japan', $4, $5::jsonb, ARRAY['one-piece'], true, NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
      role = COALESCE(EXCLUDED.role, artist_profiles.role),
      bio = COALESCE(EXCLUDED.bio, artist_profiles.bio),
      social_links = artist_profiles.social_links || EXCLUDED.social_links,
      games_illustrated = ARRAY(SELECT DISTINCT unnest(artist_profiles.games_illustrated || EXCLUDED.games_illustrated)),
      updated_at = NOW();
  `, [slug, artistName, role, cleanBio.substring(0, 500), JSON.stringify(socialLinks)]);

  console.log(`[SAVED OP] ${artistName} -> X: ${twitterUrl || "N/A"} | Role: ${role}`);
  return true;
}

async function main() {
  console.log("================================================================");
  console.log("Enriching One Piece Illustrators via Commercial Portfolios & X");
  console.log("================================================================\n");

  const topOP = await dbQuery<{ artist: string; card_count: string }>(`
    SELECT c.artist, COUNT(c.id) as card_count
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = 'one-piece'
      AND c.artist IS NOT NULL 
      AND c.artist != '' 
      AND c.artist != 'Unknown'
    GROUP BY c.artist
    HAVING COUNT(c.id) >= 10
    ORDER BY COUNT(c.id) DESC
  `);

  console.log(`Found ${topOP.length} prominent One Piece artists (>= 10 cards) to enrich.`);

  for (let i = 0; i < topOP.length; i++) {
    const a = topOP[i];
    process.stdout.write(`[${i + 1}/${topOP.length}] Processing ${a.artist} (${a.card_count} cards)... `);
    await enrichOnePieceArtist(a.artist);
    await new Promise(r => setTimeout(r, 600)); // Polite spacing
  }

  console.log("\nDone enriching prominent One Piece illustrators!");
}

main().catch(console.error);
