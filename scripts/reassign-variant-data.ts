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
  console.log("🚀 Starting Phase 2: Variant Data Reassignment...");
  
  const { data: variantCards, error: err } = await supabase
    .from('cards')
    .select('id, slug, snkrdunk_url, yuyutei_url, pricecharting_url, cardrush_url')
    .like('slug', 'op-%-ja')
    .like('number', '%\\_p%');
    
  if (err || !variantCards) {
    console.error("Failed to fetch variant cards", err);
    return;
  }
  
  console.log(`Found ${variantCards.length} variant cards. Processing...`);

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

  let reassignedHistoryCount = 0;
  let deletedDuplicateHistoryCount = 0;
  let reassignedMappingCount = 0;
  let deletedDuplicateMappingCount = 0;
  let clearedUrlsCount = 0;

  for (let i = 0; i < variantCards.length; i++) {
    const card = variantCards[i];
    const baseSlug = card.slug.replace(/_p\d+-ja$/, '-ja');
    
    const { data: baseCard } = await supabase
      .from('cards')
      .select('id')
      .eq('slug', baseSlug)
      .single();
      
    if (!baseCard) {
      console.log(`⚠️ Warning: Base card not found for ${card.slug} (${baseSlug})`);
      continue;
    }

    const mappings = mappingDict[card.id] || [];
    let modifiedCardUrls = false;
    const urlUpdates: any = {};
    
    for (const mapping of mappings) {
      const url = (mapping.external_url || '').toLowerCase();
      const title = (mapping.external_title || '').toLowerCase();
      const combinedText = `${url} ${title}`;
      
      const hasVariantKeyword = VARIANT_KEYWORDS.some(kw => combinedText.includes(kw));
      
      if (!hasVariantKeyword) {
        // This mapping is WRONG. It belongs to the base card.
        
        // 1. Reassign price_history
        const { data: historyRows } = await supabase
          .from('price_history')
          .select('id')
          .eq('card_id', card.id)
          .eq('source', mapping.source);
          
        if (historyRows && historyRows.length > 0) {
          for (const row of historyRows) {
            const { error: updateErr } = await supabase
              .from('price_history')
              .update({ card_id: baseCard.id })
              .eq('id', row.id);
              
            if (updateErr) {
              await supabase.from('price_history').delete().eq('id', row.id);
              deletedDuplicateHistoryCount++;
            } else {
              reassignedHistoryCount++;
            }
          }
        }
        
        // 2. Reassign card_source_mapping
        const { error: mappingUpdateErr } = await supabase
          .from('card_source_mapping')
          .update({ card_id: baseCard.id })
          .eq('id', mapping.id);
          
        if (mappingUpdateErr) {
          await supabase.from('card_source_mapping').delete().eq('id', mapping.id);
          deletedDuplicateMappingCount++;
        } else {
          reassignedMappingCount++;
        }
        
        // 3. Clear URL from variant card
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
    
    if (i % 50 === 0 && i > 0) console.log(`Processed ${i} cards...`);
  }

  console.log("✅ Phase 2 Reassignment Complete!");
  console.log(`- Reassigned History Rows: ${reassignedHistoryCount}`);
  console.log(`- Deleted Duplicate History Rows: ${deletedDuplicateHistoryCount}`);
  console.log(`- Reassigned Mappings: ${reassignedMappingCount}`);
  console.log(`- Deleted Duplicate Mappings: ${deletedDuplicateMappingCount}`);
  console.log(`- Cleared URLs on Variant Cards: ${clearedUrlsCount}`);
}

runReassignment().catch(console.error);
