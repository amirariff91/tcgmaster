import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
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
    ],
  },
};

export default nextConfig;
