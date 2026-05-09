import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 3600; // Regenerate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const base = 'https://tcgmaster.com';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/pokemon`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/market`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
  ];

  type GameRef = { slug: string } | null;
  type SetSitemapRow = {
    slug: string;
    updated_at: string | null;
    games: GameRef | GameRef[];
  };
  type CardSitemapRow = {
    slug: string;
    updated_at: string | null;
    sets: (Pick<SetSitemapRow, 'slug'> & { games: GameRef | GameRef[] }) | Array<Pick<SetSitemapRow, 'slug'> & { games: GameRef | GameRef[] }> | null;
  };

  // Fetch all sets
  const { data: sets } = await supabase
    .from('sets')
    .select('slug, updated_at, games(slug)')
    .order('release_date', { ascending: false });

  const setPages: MetadataRoute.Sitemap = ((sets || []) as SetSitemapRow[]).map((s) => {
    const game = Array.isArray(s.games) ? s.games[0] : s.games;
    return {
      url: `${base}/${game?.slug || 'pokemon'}/${s.slug}`,
      lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    };
  });

  // Fetch all cards (batch — limit to avoid huge response)
  const { data: cards } = await supabase
    .from('cards')
    .select('slug, updated_at, sets(slug, games(slug))')
    .order('name');

  const cardPages: MetadataRoute.Sitemap = ((cards || []) as CardSitemapRow[]).map((c) => {
    const set = Array.isArray(c.sets) ? c.sets[0] : c.sets;
    const game = set && (Array.isArray(set.games) ? set.games[0] : set.games);
    return {
      url: `${base}/${game?.slug || 'pokemon'}/${set?.slug || 'unknown'}/${c.slug}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    };
  });

  return [...staticPages, ...setPages, ...cardPages];
}
