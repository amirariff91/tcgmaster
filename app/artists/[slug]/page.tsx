import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolveArtistFromSlug, getArtistProfile, getCardsByArtist } from '@/lib/artists/service';
import { ArtistDetailClient } from './artist-detail-client';

interface ArtistPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params;
  const artistName = await resolveArtistFromSlug(slug);

  if (!artistName) {
    return {
      title: 'Artist Not Found | TCGMaster',
    };
  }

  return {
    title: `${artistName} - TCG Cards, Artworks & Biography | TCGMaster`,
    description: `Explore all trading card game artworks, biographical background, and signature cards illustrated by ${artistName}.`,
  };
}

export const revalidate = 3600; // 1 hour revalidation

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { slug } = await params;
  const artistName = await resolveArtistFromSlug(slug);

  if (!artistName) {
    notFound();
  }

  const [profile, cards] = await Promise.all([
    getArtistProfile(artistName, slug),
    getCardsByArtist(artistName),
  ]);

  return (
    <ArtistDetailClient
      artist={artistName}
      profile={profile}
      cards={cards}
    />
  );
}
