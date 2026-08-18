import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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

async function runAudit() {
  console.log("🚀 Starting Variant Mapping Audit (Fast Mode)...");

  const { data: variantCards, error: err } = await supabase
    .from('cards')
    .select('id, slug, name')
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

  const mappingDict: Record<string, Array<{
    card_id: string;
    source: string;
    external_url: string | null;
    external_title: string | null;
  }>> = {};
  for (const m of (allMappings || [])) {
    if (!mappingDict[m.card_id]) mappingDict[m.card_id] = [];
    mappingDict[m.card_id].push(m);
  }

  // We'll just omit the exact row count per source to keep the script blazingly fast,
  // or we can just say "Has Data" vs "No Data". For now, we omit it to get the mapping status.

  const csvRows = [];
  csvRows.push("Variant_Slug,Source,Status,Base_Slug,External_URL,External_Title,Local_Name");

  for (let i = 0; i < variantCards.length; i++) {
    const card = variantCards[i];
    const baseSlug = card.slug.replace(/_p\d+-ja$/, '-ja');

    const mappings = mappingDict[card.id] || [];

    // We only care about existing mappings for the audit
    for (const mapping of mappings) {
      const url = (mapping.external_url || '').toLowerCase();
      const title = (mapping.external_title || '').toLowerCase();
      const combinedText = `${url} ${title}`;

      let status = 'WRONG';
      const hasVariantKeyword = VARIANT_KEYWORDS.some(kw => combinedText.includes(kw));
      if (hasVariantKeyword) {
        status = 'CORRECT';
      }

      csvRows.push(`${card.slug},${mapping.source},${status},${baseSlug},${mapping.external_url},"${(mapping.external_title || '').replace(/"/g, '""')}","${card.name.replace(/"/g, '""')}"`);
    }
  }

  const outPath = path.join(process.cwd(), 'audit_report.csv');
  fs.writeFileSync(outPath, csvRows.join('\n'));

  console.log(`✅ Audit complete! Wrote report to ${outPath}`);
}

runAudit().catch(console.error);
