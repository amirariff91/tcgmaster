import { dbQuery } from "../lib/db/client";

async function main() {
  const cards = await dbQuery<any>(`
    SELECT slug, name, yuyutei_url, snkrdunk_url
    FROM cards
    WHERE slug IN ('op-op05-119_p1-ja', 'op-op05-119_p3-ja', 'op-op05-119_p5-ja', 'op-op05-119_p6-ja', 'op-op05-119_p7-ja', 'op-op05-119_p8-ja')
    ORDER BY slug;
  `);
  for (const c of cards) {
    console.log(c.slug, "|", c.name);
    console.log("  yuyutei:", c.yuyutei_url);
    console.log("  snkrdunk:", c.snkrdunk_url);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
