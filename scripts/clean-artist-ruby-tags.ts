import { dbQuery } from '../lib/db/client';
import { redis } from '../lib/redis/client';

async function main() {
  console.log('--- Cleaning MediaWiki Ruby Tags from artist_profiles ---');

  // Find all profiles with {{ruby tags
  const rows = await dbQuery<{ slug: string; japanese_name: string }>(`
    SELECT slug, japanese_name
    FROM artist_profiles
    WHERE japanese_name LIKE '%{{ruby%' OR japanese_name LIKE '%{{%'
  `);

  console.log(`Found ${rows.length} artist profiles with unparsed tags.`);

  for (const row of rows) {
    // Replace {{ruby|KANJI|furigana}} and {{tt|KANJI|furigana}} with KANJI
    const cleanJp = row.japanese_name
      .replace(/\{\{(?:ruby|tt)\|([^}|]+)\|[^}]+\}\}/g, '$1')
      .replace(/\{\{[^}]+\}\}/g, '')
      .replace(/'''?/g, '')
      .trim();

    console.log(`- ${row.slug}: "${row.japanese_name}" -> "${cleanJp}"`);

    await dbQuery(`
      UPDATE artist_profiles
      SET japanese_name = $1, updated_at = NOW()
      WHERE slug = $2
    `, [cleanJp, row.slug]);
  }

  // Clear redis cache for artists hub
  try {
    await redis.del('artists:hub:summary:v1');
    console.log('Cleared redis cache for artists:hub:summary:v1');
  } catch (err) {
    console.warn('Could not clear redis cache:', err);
  }

  console.log('Done!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
