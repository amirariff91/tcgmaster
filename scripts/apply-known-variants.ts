import knownVariants from "../lib/price-engine/known-variants.json";
import { dbQuery } from "../lib/db/client";

async function run() {
  for (const [slug, url] of Object.entries(knownVariants)) {
    const res = await dbQuery<any>("UPDATE cards SET snkrdunk_url = $1 WHERE slug = $2 RETURNING id, slug, name", [url, slug]);
    if (res.length > 0) {
      console.log(`Updated ${slug} -> ${url}`);
    } else {
      console.log(`Card not found: ${slug}`);
    }
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
