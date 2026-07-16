import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

async function run() {
  if (!redis) {
    console.error('Redis is not configured. Cannot save trending list.');
    return;
  }

  console.log('Generating Trending List...');

  // In a full production app, we would query search_analytics for top clicked cards
  // Here we will create a curated "Hot List" by finding highly valued cards across multiple games
  // to ensure the list looks exciting.

  const { data: cards, error } = await supabase
    .from('cards')
    .select(`
      id,
      name,
      slug,
      number,
      rarity,
      image_url,
      local_image_url,
      sets!inner (
        name,
        slug,
        games!inner (
          slug
        )
      ),
      price_cache (
        raw_prices
      )
    `)
    .not('price_cache', 'is', null)
    .limit(1000);

  if (error || !cards) {
    console.error('Failed to fetch cards for trending generation:', error);
    return;
  }

  console.log(`Analyzing ${cards.length} cards...`);

  // Transform and score cards
  const scoredCards = cards.map((card: any) => {
    const marketPrice = card.price_cache?.[0]?.raw_prices?.market || 0;
    
    // Create a "hot score".
    // 1. High value cards get a boost.
    // 2. We inject some randomness so the list changes slightly each day.
    const score = marketPrice + (Math.random() * 20);

    return {
      id: card.id,
      name: card.name,
      setName: card.sets?.name || '',
      setSlug: card.sets?.slug || '',
      number: card.number,
      rarity: card.rarity,
      imageUrl: card.local_image_url || card.image_url,
      marketPrice: marketPrice || null,
      slug: card.slug,
      game: card.sets?.games?.slug || 'pokemon',
      score: score,
    };
  });

  // Sort by score and take top 24
  scoredCards.sort((a, b) => b.score - a.score);
  const trendingList = scoredCards.slice(0, 24);

  // Save to redis in the SearchResponse format
  const payload = {
    results: trendingList,
    parsed: {},
    pagination: {
      page: 1,
      pageSize: 24,
      totalCount: 24,
      hasMore: false,
    }
  };

  // Cache in Redis indefinitely (or until the next cron run)
  await redis.set('api:search:trending', payload);
  
  console.log(`Successfully pushed ${trendingList.length} trending cards to Redis.`);
}

run().catch(console.error);
