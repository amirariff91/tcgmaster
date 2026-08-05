import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: ['.env.local', '.env'] });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const VARIANT_KEYWORDS = [
  'alternate art', 'manga', 'parallel', 'super parallel', 'sp', 'special', 
  'wanted', 'serialized', 'serial number', 'serial prize', 'anniversary', 
  'top 8', 'flagship', 'winner', 'championship', 'tournament', 'premium', 
  'スーパーパラレル'
];

async function getAllVariants() {
  let allCards: any[] = [];
  let page = 0;
  while (true) {
    const { data } = await supabase
      .from('cards')
      .select('id, slug, snkrdunk_url, yuyutei_url, pricecharting_url, cardrush_url')
      .like('slug', 'op-%-ja')
      .like('number', '%\\_p%')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allCards = allCards.concat(data);
    page++;
  }
  return allCards;
}

async function getAllMappings(variantIds: string[]) {
  let allMappings: any[] = [];
  for (let i = 0; i < variantIds.length; i += 500) {
    const chunk = variantIds.slice(i, i + 500);
    const { data } = await supabase
      .from('card_source_mapping')
      .select('*')
      .in('card_id', chunk);
    if (data) allMappings = allMappings.concat(data);
  }
  return allMappings;
}

async function runReassignment() {
  console.log("🚀 Starting Phase 2: Proper Reassignment...");
  
  const variantCards = await getAllVariants();
  console.log(`Found ${variantCards.length} total variant cards.`);
  
  const variantIds = variantCards.map(c => c.id);
  const allMappings = await getAllMappings(variantIds);
  console.log(`Found ${allMappings.length} mappings for variants.`);
  
  const mappingDict: Record<string, any[]> = {};
  for (const m of allMappings) {
    if (!mappingDict[m.card_id]) mappingDict[m.card_id] = [];
    mappingDict[m.card_id].push(m);
  }

  let totalProcessed = 0;
  let clearedUrlsCount = 0;
  let deletedHistory = 0;
  let updatedHistory = 0;

  for (const card of variantCards) {
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
        // Find history on variant
        const { data: varHistory } = await supabase.from('price_history').select('id, recorded_at, grade').eq('card_id', card.id).eq('source', mapping.source);
        
        if (varHistory && varHistory.length > 0) {
          const { data: baseHistory } = await supabase.from('price_history').select('recorded_at, grade').eq('card_id', baseCard.id).eq('source', mapping.source);
          const baseSet = new Set((baseHistory || []).map(h => `${h.recorded_at}_${h.grade}`));
          
          const duplicates = varHistory.filter(h => baseSet.has(`${h.recorded_at}_${h.grade}`)).map(h => h.id);
          const toUpdate = varHistory.filter(h => !baseSet.has(`${h.recorded_at}_${h.grade}`)).map(h => h.id);
          
          if (duplicates.length > 0) {
            for (let j=0; j<duplicates.length; j+=200) {
               await supabase.from('price_history').delete().in('id', duplicates.slice(j, j+200));
               deletedHistory += duplicates.slice(j, j+200).length;
            }
          }
          if (toUpdate.length > 0) {
            for (let j=0; j<toUpdate.length; j+=200) {
               await supabase.from('price_history').update({ card_id: baseCard.id }).in('id', toUpdate.slice(j, j+200));
               updatedHistory += toUpdate.slice(j, j+200).length;
            }
          }
        }
        
        // Reassign mapping
        const { error: mappingUpdateErr } = await supabase
          .from('card_source_mapping')
          .update({ card_id: baseCard.id })
          .eq('id', mapping.id);
          
        if (mappingUpdateErr) {
          await supabase.from('card_source_mapping').delete().eq('id', mapping.id);
        }
        
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
    
    totalProcessed++;
    if (totalProcessed % 50 === 0) console.log(`Processed ${totalProcessed} cards...`);
  }

  console.log("✅ Phase 2 Reassignment Complete!");
  console.log(`- Cards processed for URL clear: ${clearedUrlsCount}`);
  console.log(`- Duplicates deleted: ${deletedHistory}`);
  console.log(`- Base cards updated with history: ${updatedHistory}`);
}

runReassignment().catch(console.error);
