import { MetadataRoute } from 'next';
import { dbQuery } from '@/lib/db/client';

export const revalidate = 3600; // Regenerate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://tcgmaster.com';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/pokemon`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/market`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
  ];

  type SetSitemapRow = {
    slug: string;
    created_at: string | null;
    game_slug: string;
  };
  type CardSitemapRow = {
    slug: string;
    updated_at: string | null;
    set_slug: string;
    game_slug: string;
  };

  try {
    // JOINs preserve the same one-to-one nested shape as the old embeds.
    const sets = await dbQuery<SetSitemapRow>(`
      SELECT
        s.slug,
        s.created_at,
        g.slug AS game_slug
      FROM sets s
      JOIN games g ON g.id = s.game_id
      ORDER BY s.release_date DESC NULLS LAST
    `);

    const cards = await dbQuery<CardSitemapRow>(`
      SELECT
        c.slug,
        c.updated_at,
        s.slug AS set_slug,
        g.slug AS game_slug
      FROM cards c
      JOIN sets s ON s.id = c.set_id
      JOIN games g ON g.id = s.game_id
      ORDER BY c.name
    `);

    const setPages: MetadataRoute.Sitemap = sets.map((s) => ({
      url: `${base}/${s.game_slug || 'pokemon'}/${s.slug}`,
      lastModified: s.created_at ? new Date(s.created_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    const cardPages: MetadataRoute.Sitemap = cards.map((c) => ({
      url: `${base}/${c.game_slug || 'pokemon'}/${c.set_slug || 'unknown'}/${c.slug}`,
      lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));

    return [...staticPages, ...setPages, ...cardPages];
  } catch (error) {
    // Sitemap generation must never make a deployment fail when the DB is absent
    // or unreachable during the image build.
    console.error('Failed to generate sitemap:', error);
    return [];
  }
}
