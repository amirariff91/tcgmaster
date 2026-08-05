import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const VARIANT_KEYWORDS = [
  'alternate art', 'manga', 'parallel', 'super parallel', 'sp', 'special', 
  'wanted', 'serialized', 'serial number', 'serial prize', 'anniversary', 
  'top 8', 'flagship', 'winner', 'championship', 'tournament', 'premium', 
  'スーパーパラレル'
];

async function runReassignment() {
  console.log("🚀 Starting Phase 2: Variant Data Reassignment (FAST BATCH)...");
  
  const { data: variantCards, error: err } = await supabase
    .from('cards')
    .select('id, slug, snkrdunk_url, yuyutei_url, pricecharting_url, cardrush_url')
    .like('slug', 'op-%-ja')
    .like('number', '%\\_p%');
    
  if (err || !variantCards) {
    console.error("Failed to fetch variant cards", err);
    return;
  }
  
  const variantIds = variantCards.map(c => c.id);
  const { data: allMappings } = await supabase
    .from('card_source_mapping')
    .select('*')
    .in('card_id', variantIds);
    
  const mappingDict: Record<string, any[]> = {};
  for (const m of (allMappings || [])) {
    if (!mappingDict[m.card_id]) mappingDict[m.card_id] = [];
    mappingDict[m.card_id].push(m);
  }

  let totalUpdated = 0;
  let clearedUrlsCount = 0;

  for (let i = 0; i < variantCards.length; i++) {
    const card = variantCards[i];
    const baseSlug = card.slug.replace(/_p\d+-ja$/, '-ja');
    
    const { data: baseCard } = await supabase
      .from('cards')
      .select('id')
      .eq('slug', baseSlug)
      .single();
      
    if (!baseCard) continue;

    const mappings = mappingDict[card.id] || [];
    let modifiedCardUrls = false;
    const urlUpdates: any = {};
    
    for (const mapping of mappings) {
      const url = (mapping.external_url || '').toLowerCase();
      const title = (mapping.external_title || '').toLowerCase();
      const combinedText = `${url} ${title}`;
      
      const hasVariantKeyword = VARIANT_KEYWORDS.some(kw => combinedText.includes(kw));
      
      if (!hasVariantKeyword) {
        // Bulk attempt
        const { error: bulkErr } = await supabase
          .from('price_history')
          .update({ card_id: baseCard.id })
          .eq('card_id', card.id)
          .eq('source', mapping.source);
          
        if (bulkErr) {
          // Fallback to deduping first
          const { data: baseHistory } = await supabase.from('price_history').select('recorded_at, grade').eq('card_id', baseCard.id).eq('source', mapping.source);
          const { data: varHistory } = await supabase.from('price_history').select('id, recorded_at, grade').eq('card_id', card.id).eq('source', mapping.source);
          
          if (baseHistory && varHistory) {
            const baseSet = new Set(baseHistory.map(h => `${h.recorded_at}_${h.grade}`));
            const duplicates = varHistory.filter(h => baseSet.has(`${h.recorded_at}_${h.grade}`)).map(h => h.id);
            const toUpdate = varHistory.filter(h => !baseSet.has(`${h.recorded_at}_${h.grade}`)).map(h => h.id);
            
            // Delete duplicates
            if (duplicates.length > 0) {
              for (let j=0; j<duplicates.length; j+=500) {
                 await supabase.from('price_history').delete().in('id', duplicates.slice(j, j+500));
              }
            }
            // Update non-duplicates
            if (toUpdate.length > 0) {
              for (let j=0; j<toUpdate.length; j+=500) {
                 await supabase.from('price_history').update({ card_id: baseCard.id }).in('id', toUpdate.slice(j, j+500));
                 totalUpdated += toUpdate.slice(j, j+500).length;
              }
            }
          }
        } else {
          // If bulk succeeded, we don't know the exact count updated in this fast script without another query, but we know it worked.
          totalUpdated++;
        }
        
        // Reassign card_source_mapping
        const { error: mappingUpdateErr } = await supabase
          .from('card_source_mapping')
          .update({ card_id: baseCard.id })
          .eq('id', mapping.id);
          
        if (mappingUpdateErr) {
          await supabase.from('card_source_mapping').delete().eq('id', mapping.id);
        }
        
        // Clear URL from variant card
        if (mapping.source === 'pricecharting') urlUpdates.pricecharting_url = null;
        if (mapping.source === 'snkrdunk') urlUpdates.snkrdunk_url = null;
        if (mapping.source === 'yuyutei') urlUpdates.yuyutei_url = null;
        if (mapping.source === 'cardrush') urlUpdates.cardrush_url = null;
        
        modifiedCardUrls = true;
      }
    }
    
    if (modifiedCardUrls) {
      urlUpdates.curation_status = 'pending';
      await supabase
        .from('cards')
        .update(urlUpdates)
        .eq('id', card.id);
      clearedUrlsCount++;
    }
    
    if (i % 100 === 0 && i > 0) console.log(`Processed ${i} cards...`);
  }

  console.log("✅ Phase 2 Reassignment Complete!");
  console.log(`- Cards processed for URL clear: ${clearedUrlsCount}`);
}

runReassignment().catch(console.error);
