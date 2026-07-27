import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  console.log("Starting price history reconciliation & rearrangement V2...");

  let allCards: any[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error: cardError } = await supabase
      .from('cards')
      .select('id, slug, name, number, print_run_info')
      .ilike('slug', 'op-%')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (cardError) {
      console.error("Failed to load cards", cardError);
      return;
    }

    if (data && data.length > 0) {
      allCards = [...allCards, ...data];
      page++;
    } else {
      hasMore = false;
    }
  }

  // Group cards correctly: keep Japanese and English separate!
  // Example slug: op-op01-120_p1-ja -> base slug should be op-op01-120-ja
  // Example slug: op-op01-120_p1 -> base slug should be op-op01-120
  const cardsByBaseSlug = new Map<string, any[]>();
  
  for (const card of allCards) {
    // To find the base slug, we remove any _pX or _rX or _aa from the slug
    const baseSlug = card.slug.replace(/_[a-zA-Z0-9]+/, '');
    
    const group = cardsByBaseSlug.get(baseSlug) || [];
    group.push(card);
    cardsByBaseSlug.set(baseSlug, group);
  }

  console.log(`Grouped ${allCards.length} cards into ${cardsByBaseSlug.size} unique base slugs.`);

  let totalReassigned = 0;

  for (const [baseSlug, cardGroup] of cardsByBaseSlug.entries()) {
    // Find the base card (its slug perfectly matches the baseSlug)
    const baseCard = cardGroup.find(c => c.slug === baseSlug);
    if (!baseCard) continue;

    // Find the variant cards (slug contains underscore)
    const variants = cardGroup.filter(c => c.slug !== baseSlug);
    if (variants.length === 0) continue;

    // Fetch price history of the base card
    const { data: baseHistory, error: histError } = await supabase
      .from('price_history')
      .select('id, price, source, grade, recorded_at')
      .eq('card_id', baseCard.id);

    if (histError || !baseHistory || baseHistory.length === 0) continue;

    // Calculate median price of base card
    const sortedPrices = baseHistory.map(h => h.price).sort((a, b) => a - b);
    const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];

    // Find abnormally high prices on base card (spike > 5x median AND price > 15)
    // We lowered the threshold to 15 to catch SP and lower-value AA cards.
    const highPrices = baseHistory.filter(h => h.price > medianPrice * 5 && h.price > 15);

    if (highPrices.length > 0) {
      console.log(`Card ${baseCard.slug} (Median: $${medianPrice}) has ${highPrices.length} abnormally high price entries:`);
      
      for (const entry of highPrices) {
        // Find correct variant to move it to based on the price tier
        let targetVariant = null;

        // If price is extremely high, target Manga or Serialized
        if (entry.price > 300) {
          targetVariant = variants.find(v => {
            const type = v.print_run_info?.variant_type?.toLowerCase() || '';
            return type.includes('manga') || type.includes('serialized');
          });
        }
        
        // Fallback or moderate price targets Alt Art / Special Card
        if (!targetVariant) {
          targetVariant = variants.find(v => {
            const type = v.print_run_info?.variant_type?.toLowerCase() || '';
            return type.includes('alternate art') || type.includes('special') || type.includes('sp');
          });
        }

        // If still not found, target the first variant
        if (!targetVariant && variants.length > 0) {
          targetVariant = variants[0];
        }

        if (targetVariant) {
          console.log(`-> Reassigning entry ID ${entry.id} ($${entry.price}) to ${targetVariant.slug}`);
          
          const { error: updateError } = await supabase
            .from('price_history')
            .update({ card_id: targetVariant.id })
            .eq('id', entry.id);

          if (updateError) {
            console.error(`Failed to move entry: ${updateError.message}`);
          } else {
            totalReassigned++;
          }
        }
      }
    }
  }

  console.log(`\nReconciliation Complete!`);
  console.log(`Reassigned ${totalReassigned} misplaced high-end prices.`);
}

run().catch(console.error);
