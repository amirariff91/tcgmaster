import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Cloudflare R2 CDN (TCGMaster Images)
      {
        protocol: "https",
        hostname: "images.tcgmaster.com",
      },
      // Supabase Storage (local_image_url)
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Pokemon TCG API CDN
      {
        protocol: "https",
        hostname: "images.pokemontcg.io",
      },
      // PokemonPriceTracker CDN
      {
        protocol: "https",
        hostname: "*.pokemonpricetracker.com",
      },
      {
        protocol: "https",
        hostname: "www.pokemonpricetracker.com",
      },
      // TCGPlayer CDN (common card image host)
      {
        protocol: "https",
        hostname: "product-images.tcgplayer.com",
      },
      {
        protocol: "https",
        hostname: "*.tcgplayer.com",
      },
      // Cloudflare / generic CDN patterns
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
      },
      // One Piece Card Game official site (for bypassing CORP)
      {
        protocol: "https",
        hostname: "www.onepiece-cardgame.com",
      },
      {
        protocol: "https",
        hostname: "en.onepiece-cardgame.com",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
