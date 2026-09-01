import { dbQuery } from './lib/db/client';

async function main() {
  const sets = await dbQuery("SELECT id, slug, name FROM sets");
  console.log(sets.map((s: any) => `${s.slug} -> ${s.id}`).join('\n'));
  process.exit(0);
}
main();
