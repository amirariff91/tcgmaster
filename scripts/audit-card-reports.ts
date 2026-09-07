import { dbQuery } from "../lib/db/client";

async function main() {
  console.log("================================================================");
  console.log("TCGMaster Card & Price Accuracy Triage Queue");
  console.log("================================================================\n");

  const reports = await dbQuery<{
    id: string;
    card_name: string;
    card_number: string;
    card_slug: string;
    set_name: string;
    game_slug: string;
    category: string;
    expected_price_cents: number | null;
    current_price_snapshot: number | null;
    current_source_snapshot: string | null;
    suggested_url: string | null;
    description: string | null;
    status: string;
    created_at: string;
  }>(`
    SELECT 
      r.id,
      c.name as card_name,
      c.number as card_number,
      c.slug as card_slug,
      s.name as set_name,
      g.slug as game_slug,
      r.category,
      r.expected_price_cents,
      r.current_price_snapshot,
      r.current_source_snapshot,
      r.suggested_url,
      r.description,
      r.status,
      r.created_at
    FROM card_accuracy_reports r
    JOIN cards c ON c.id = r.card_id
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    ORDER BY r.created_at DESC
    LIMIT 20
  `);

  if (reports.length === 0) {
    console.log("No card accuracy reports found. Everything is clean!");
    return;
  }

  console.log(`Found ${reports.length} recent card reports:\n`);
  for (const r of reports) {
    const curPriceStr = r.current_price_snapshot ? `$${(r.current_price_snapshot / 100).toFixed(2)}` : "No price";
    const expPriceStr = r.expected_price_cents ? `$${(r.expected_price_cents / 100).toFixed(2)}` : "Not specified";

    console.log(`[${r.status.toUpperCase()}] ${r.card_name} (${r.card_number}) - ${r.set_name} [${r.game_slug}]`);
    console.log(`  Issue: ${r.category} | Current: ${curPriceStr} (${r.current_source_snapshot || "N/A"}) -> Expected: ${expPriceStr}`);
    if (r.suggested_url) console.log(`  Suggested URL: ${r.suggested_url}`);
    if (r.description) console.log(`  User Notes: "${r.description}"`);
    console.log(`  Reported At: ${r.created_at} | ID: ${r.id}\n`);
  }
}

main().catch(console.error);
