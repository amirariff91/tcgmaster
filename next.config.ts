import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Card art is ~600px and every card <Image> goes through the Cloudflare loader,
    // which snaps to 160/320/640/1280. Narrowing the candidate widths here keeps the
    // generated srcset aligned with those buckets instead of Next's default 8+8
    // widths, which would multiply unique Cloudflare transformations (Free cap: 5,000/mo).
    deviceSizes: [640, 1280],
    imageSizes: [160, 320],
    remotePatterns: [
      // Supabase Storage (local_image_url) — retain during R2 cutover/rollback window
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Cloudflare R2 via the Image Transformations custom domain
      {
        protocol: "https",
        hostname: "images.tcgmaster.com",
        pathname: "/**",
      },
      // Pokemon TCG API CDN
      {
        protocol: "https",
        hostname: "images.pokemontcg.io",
      },
      // TCGdex Japanese Pokemon CDN
      {
        protocol: "https",
        hostname: "assets.tcgdex.net",
      },
      // Riot Games / Riftbound Sanity CDN
      {
        protocol: "https",
        hostname: "cmsassets.rgpub.io",
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
      // Scrydex CDN
      {
        protocol: "https",
        hostname: "images.scrydex.com",
      },
      {
        protocol: "https",
        hostname: "*.scrydex.com",
      },
      // DotGG CDN
      {
        protocol: "https",
        hostname: "static.dotgg.gg",
      },
      {
        protocol: "https",
        hostname: "*.dotgg.gg",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
