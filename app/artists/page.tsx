import { Metadata } from 'next';
import { dbQuery } from '@/lib/db/client';
import { getTopArtistsByGame } from '@/lib/artists/service';
import { ArtistsHubClient } from './artists-hub-client';

export const metadata: Metadata = {
  title: 'TCG Illustrators & Master Artists | TCGMaster',
  description: 'Explore the legendary illustrators, manga artists, and studios behind your favorite trading card games.',
};

export const revalidate = 3600; // 1 hour revalidation

export default async function ArtistsPage() {
  const games = await dbQuery<{ id: string; slug: string; name: string }>(`
    SELECT id, slug, name
    FROM games
    WHERE is_active = true
    ORDER BY 
      CASE slug 
        WHEN 'one-piece' THEN 1
        WHEN 'pokemon' THEN 2
        WHEN 'riftbound' THEN 3
        WHEN 'dbfw' THEN 4
        ELSE 5
      END ASC
  `);

  const artistsByGame = await getTopArtistsByGame();

  return <ArtistsHubClient games={games} artistsByGame={artistsByGame} />;
}
