import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  console.log("Starting price history reconciliation & rearrangement...");

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

  // Group cards by their base card number (e.g. OP01-120)
  const cardsByNumber = new Map<string, any[]>();
  for (const card of allCards) {
    const cleanNumber = card.number.split('_')[0].split('-ja')[0];
    const group = cardsByNumber.get(cleanNumber) || [];
    group.push(card);
    cardsByNumber.set(cleanNumber, group);
  }

  console.log(`Grouped ${allCards.length} cards into ${cardsByNumber.size} unique card numbers.`);

  let totalReassigned = 0;
  let totalDeleted = 0;

  for (const [number, cardGroup] of cardsByNumber.entries()) {
    // Find the base card (slug has no underscore)
    const baseCard = cardGroup.find(c => !c.slug.includes('_'));
    if (!baseCard) continue;

    // Find the variant cards (slug contains underscore)
    const variants = cardGroup.filter(c => c.slug.includes('_'));
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

    // Find abnormally high prices on base card (spike > 5x median AND price > 30)
    const highPrices = baseHistory.filter(h => h.price > medianPrice * 5 && h.price > 30);

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

    // Clean variant card histories of duplicate/poisoned low prices
    for (const variant of variants) {
      const { data: varHistory } = await supabase
        .from('price_history')
        .select('id, price')
        .eq('card_id', variant.id);

      if (!varHistory || varHistory.length === 0) continue;

      // Find low prices that are duplicates of the base card (e.g. price < base median * 1.5)
      const poisonedLowPrices = varHistory.filter(h => h.price < medianPrice * 1.5 || h.price < 15);
      
      // We only delete low prices if the card is high value (so it shouldn't have low prices)
      const isHighValueVariant = variant.print_run_info?.variant_type?.toLowerCase().includes('manga') ||
                                 variant.print_run_info?.variant_type?.toLowerCase().includes('serialized') ||
                                 variant.print_run_info?.variant_type?.toLowerCase().includes('wanted');
                                 
      if (isHighValueVariant && poisonedLowPrices.length > 0) {
        console.log(`Variant ${variant.slug} has ${poisonedLowPrices.length} duplicate base price entries to remove.`);
        
        const idsToDelete = poisonedLowPrices.map(p => p.id);
        const { error: deleteError } = await supabase
          .from('price_history')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error(`Failed to delete low prices: ${deleteError.message}`);
        } else {
          totalDeleted += idsToDelete.length;
        }
      }
    }
  }

  console.log(`Reconciliation Complete!`);
  console.log(`Reassigned ${totalReassigned} misplaced high-end prices.`);
  console.log(`Deleted ${totalDeleted} duplicate base price entries from variants.`);
  process.exit(0);
}

run();
