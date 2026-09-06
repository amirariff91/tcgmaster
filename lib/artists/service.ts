import { dbQuery } from '@/lib/db/client';
import { redis } from '@/lib/redis/client';
import artistProfilesJson from './artist-profiles.json';

export interface ArtistProfile {
  name: string;
  slug: string;
  japaneseName?: string;
  role?: string;
  country?: string;
  birth?: string;
  bio: string;
  notableWorks?: string[];
  games?: string[];
  photoUrl?: string;
}

export interface ArtistSummary {
  artist: string;
  slug: string;
  cardCount: number;
  gameSlug: string;
  gameName: string;
  role?: string;
  japaneseName?: string;
  country?: string;
  photoUrl?: string;
}

export interface ArtistCardItem {
  id: string;
  name: string;
  slug: string;
  number: string;
  rarity: string | null;
  imageUrl: string | null;
  setName: string;
  setSlug: string;
  gameSlug: string;
  gameName: string;
  priceUsd: number | null;
}

export function slugifyArtist(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Fetch top artists per game, with card count and top preview artworks
 */
export async function getTopArtistsByGame(): Promise<Record<string, ArtistSummary[]>> {
  const cacheKey = 'artists:hub:summary:v1';
  try {
    const cached = await redis.get<Record<string, ArtistSummary[]>>(cacheKey);
    if (cached) return cached;
  } catch (err) {
    console.error('Redis get error in getTopArtistsByGame:', err);
  }

  const games = await dbQuery<{ id: string; slug: string; name: string }>(`
    SELECT id, slug, name
    FROM games
    WHERE is_active = true
    ORDER BY name ASC
  `);

  const results: Record<string, ArtistSummary[]> = {};

  for (const game of games) {
    const artists = await dbQuery<{ artist: string; card_count: string }>(`
      SELECT c.artist, COUNT(*) as card_count
      FROM cards c
      JOIN sets s ON s.id = c.set_id
      WHERE s.game_id = $1 
        AND c.artist IS NOT NULL 
        AND c.artist != '' 
        AND c.artist != 'Unknown'
      GROUP BY c.artist
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC
      LIMIT 36
    `, [game.id]);

    const summaries: ArtistSummary[] = artists.map(a => {
      const slug = slugifyArtist(a.artist);
      const curated = (artistProfilesJson as Record<string, any>)[slug];

      return {
        artist: a.artist,
        slug,
        cardCount: parseInt(a.card_count, 10),
        gameSlug: game.slug,
        gameName: game.name,
        role: curated?.role,
        japaneseName: curated?.japaneseName,
        country: curated?.country,
        photoUrl: curated?.photoUrl,
      };
    });

    results[game.slug] = summaries;
  }

  try {
    await redis.set(cacheKey, results, { ex: 3600 });
  } catch (err) {
    console.error('Redis set error in getTopArtistsByGame:', err);
  }

  return results;
}

/**
 * Fetch artist biography (from curated profile, Wikipedia API, or generated fallback)
 */
export async function getArtistProfile(artistName: string, slug: string): Promise<ArtistProfile> {
  const curated = (artistProfilesJson as Record<string, any>)[slug];
  if (curated) {
    return {
      ...curated,
      slug,
    };
  }

  // Fallback: try Wikipedia REST API
  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName)}`;
    const res = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'TCGMaster/1.0 (contact@tcgmaster.com)' },
      next: { revalidate: 604800 }, // Cache 7 days
    });

    if (res.ok) {
      const data = await res.json();
      if (data.type === 'standard' && data.extract && !data.title.toLowerCase().includes('disambiguation')) {
        return {
          name: artistName,
          slug,
          role: data.description || 'TCG Illustrator & Artist',
          country: 'Japan',
          bio: data.extract,
        };
      }
    }
  } catch {}

  // Clean default fallback
  return {
    name: artistName,
    slug,
    role: 'Trading Card Game Illustrator',
    bio: `${artistName} is an illustrator whose artwork is featured across official Trading Card Game card releases.`,
  };
}

/**
 * Find exact artist name in DB from a slug
 */
export async function resolveArtistFromSlug(slug: string): Promise<string | null> {
  // 1. Fast-track curated profile to avoid scanning the entire cards table
  const curated = (artistProfilesJson as Record<string, any>)[slug];
  if (curated?.name) {
    return curated.name;
  }

  // 2. Query distinct artists for uncurated artists
  const rows = await dbQuery<{ artist: string }>(`
    SELECT DISTINCT artist
    FROM cards
    WHERE artist IS NOT NULL AND artist != '' AND artist != 'Unknown'
  `);

  for (const row of rows) {
    if (slugifyArtist(row.artist) === slug) {
      return row.artist;
    }
  }
  return null;
}

/**
 * Get all cards illustrated by an artist across all games
 */
export async function getCardsByArtist(artistName: string): Promise<ArtistCardItem[]> {
  const rows = await dbQuery<{
    id: string;
    name: string;
    slug: string;
    number: string;
    rarity: string | null;
    image_url: string | null;
    local_image_url: string | null;
    set_name: string;
    set_slug: string;
    game_slug: string;
    game_name: string;
    headline_cents: number | null;
  }>(`
    SELECT c.id, c.name, c.slug, c.number, c.rarity, c.image_url, c.local_image_url,
           s.name as set_name, s.slug as set_slug,
           g.slug as game_slug, g.name as game_name,
           cpc.headline_cents
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
    WHERE c.artist ILIKE $1
    ORDER BY cpc.headline_cents DESC NULLS LAST, c.name ASC
  `, [artistName]);

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    number: r.number,
    rarity: r.rarity,
    imageUrl: r.local_image_url || r.image_url,
    setName: r.set_name,
    setSlug: r.set_slug,
    gameSlug: r.game_slug,
    gameName: r.game_name,
    priceUsd: r.headline_cents != null ? r.headline_cents / 100 : null,
  }));
}
