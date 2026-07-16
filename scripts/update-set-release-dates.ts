import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { resolve } from 'path';

// Load env
const envContent = fs.readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  if (line.includes('=')) {
    const [key, ...values] = line.split('=');
    if (!process.env[key]) {
      process.env[key] = values.join('=').trim().replace(/(^"|"$)/g, '');
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const CATEGORIES = [
    { id: 68, slugPrefix: 'op-%' },
    { id: 80, slugPrefix: 'dbfw-%' }
  ];

  let updatedCount = 0;

  for (const cat of CATEGORIES) {
    console.log(`\nFetching TCGCSV Groups for Category ${cat.id}...`);
    const res = await fetch(`https://tcgcsv.com/tcgplayer/${cat.id}/groups`, {
      headers: { 'User-Agent': 'curl/8.4.0' }
    });
    
    if (!res.ok) {
      console.error(`Failed to fetch TCGCSV groups for ${cat.id}`);
      continue;
    }
    
    const data = await res.json();
    const groups = data.results || [];
    console.log(`Fetched ${groups.length} groups from TCGCSV`);

    // Fetch sets from DB
    const { data: sets, error } = await supabase
      .from('sets')
      .select('id, name, slug')
      .ilike('slug', cat.slugPrefix);
      
    if (error || !sets) {
      console.error(`Failed to fetch sets for ${cat.slugPrefix} from DB`, error);
      continue;
    }
    
    console.log(`Fetched ${sets.length} sets for ${cat.slugPrefix} from DB`);
  
    for (const set of sets) {
      let groupMatch = null;
      
      // Try matching by name
      const cleanSetName = set.name.split(':').pop()?.trim().toLowerCase() || set.name.toLowerCase();
      groupMatch = groups.find((g: any) => cleanSetName.includes(g.name.toLowerCase()) || g.name.toLowerCase().includes(cleanSetName));
      
      // Try matching by abbreviation (e.g., OP01)
      if (!groupMatch) {
        const abbrMatch = set.name.match(/([A-Z]+-[0-9]+)/);
        if (abbrMatch) {
          const abbr = abbrMatch[1].replace('-', '');
          groupMatch = groups.find((g: any) => g.abbreviation === abbr || g.abbreviation?.includes(abbr));
        }
      }
      
      if (groupMatch && groupMatch.publishedOn) {
        const releaseDate = groupMatch.publishedOn.split('T')[0]; // Extract YYYY-MM-DD
        console.log(`Matching [${set.name}] -> TCGCSV: [${groupMatch.name}] | Release: ${releaseDate}`);
        
        const { error: updateError } = await supabase
          .from('sets')
          .update({ release_date: releaseDate })
          .eq('id', set.id);
          
        if (updateError) {
          console.error(`Failed to update ${set.name}`, updateError);
        } else {
          updatedCount++;
        }
      } else {
        console.log(`Could NOT match [${set.name}]`);
      }
    }
  }
  
  console.log(`Successfully updated ${updatedCount} total sets!`);
}

run();
