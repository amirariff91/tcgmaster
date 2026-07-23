import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const GRAY = '\x1b[90m';
const WHITE = '\x1b[97m';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(`${RED}${BOLD}Error:${RESET} Supabase environment variables missing in .env / .env.local`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function formatShortTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  return `${diffDays}d ago`;
}

function formatPrice(price: number, source: string): string {
  if (source === 'tcgplayer') {
    return `$${price.toFixed(2)}`;
  }
  return `¥${price.toLocaleString()}`;
}

async function tailLogFile(relativePath: string, linesCount = 3): Promise<string[]> {
  try {
    const absPath = path.join(process.cwd(), relativePath);
    if (!fs.existsSync(absPath)) return ['[No log file found]'];
    const stat = await fs.promises.stat(absPath);
    if (stat.size === 0) return ['[Log file empty]'];

    const readSize = Math.min(stat.size, 2048);
    const buffer = Buffer.alloc(readSize);
    const handle = await fs.promises.open(absPath, 'r');
    try {
      await handle.read(buffer, 0, readSize, stat.size - readSize);
    } finally {
      await handle.close();
    }
    const lines = buffer.toString('utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-linesCount);
  } catch {
    return ['[Failed to read log]'];
  }
}

async function renderTerminalFeed() {
  console.clear();
  const now = new Date().toLocaleTimeString();

  console.log(`${CYAN}${BOLD}===============================================================================${RESET}`);
  console.log(`${CYAN}${BOLD} 🚀 TCGMASTER MISSION CONTROL — TERMINAL LIVE FEED ${RESET} ${GRAY}(Refreshed: ${now})${RESET}`);
  console.log(`${CYAN}${BOLD}===============================================================================${RESET}\n`);

  // 1. Scraper Diagnostics
  console.log(`${BOLD}${WHITE}📡 SCRAPER PIPELINE STATUS${RESET}`);
  console.log(`${GRAY}-------------------------------------------------------------------------------${RESET}`);
  console.log(`${BOLD}${GRAY}SOURCE         STATUS       LAST SYNC          HEALTH CHECK${RESET}`);
  console.log(`${GRAY}-------------------------------------------------------------------------------${RESET}`);

  const sources = [
    { key: 'snkrdunk', name: 'Snkrdunk' },
    { key: 'yuyutei', name: 'Yuyutei' },
    { key: 'cardrush', name: 'Cardrush' },
    { key: 'tcgplayer', name: 'TCGPlayer' },
  ];

  for (const src of sources) {
    const { data } = await supabase
      .from('price_history')
      .select('recorded_at')
      .eq('source', src.key)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const dateStr = (data as { recorded_at: string } | null)?.recorded_at;
    const date = dateStr ? new Date(dateStr) : null;
    const isHealthy = date ? Date.now() - date.getTime() < 24 * 60 * 60 * 1000 : false;

    const statusBadge = isHealthy
      ? `${GREEN}${BOLD}ONLINE ${RESET}`
      : `${RED}${BOLD}STALLED${RESET}`;
    
    const lastSyncStr = date ? formatShortTime(date) : 'No data';
    const sourceNamePadded = src.name.padEnd(14, ' ');
    const statusPadded = statusBadge.padEnd(20, ' ');
    const lastSyncPadded = lastSyncStr.padEnd(18, ' ');

    console.log(` ${sourceNamePadded} ${statusPadded} ${lastSyncPadded} ${isHealthy ? `${GREEN}✔ Healthy${RESET}` : `${RED}✖ Action Needed${RESET}`}`);
  }

  // 2. Recent Live Price Updates
  console.log(`\n${BOLD}${WHITE}⚡ LIVE RECENT PRICE UPDATES (Latest 8)${RESET}`);
  console.log(`${GRAY}-------------------------------------------------------------------------------${RESET}`);

  const { data: recentPrices } = await supabase
    .from('price_history')
    .select('source, price, recorded_at, cards(name, number)')
    .order('recorded_at', { ascending: false })
    .limit(8);

  if (recentPrices && recentPrices.length > 0) {
    for (const item of recentPrices as any[]) {
      const timeStr = item.recorded_at ? formatShortTime(new Date(item.recorded_at)) : 'N/A';
      const cardName = item.cards?.name || 'Unknown Card';
      const cardNum = item.cards?.number || '?';
      const priceFormatted = formatPrice(item.price || 0, item.source);
      const sourceCol = item.source === 'tcgplayer' ? MAGENTA : CYAN;

      console.log(` ${GRAY}[${timeStr.padStart(7)}]${RESET} ${sourceCol}${item.source.toUpperCase().padEnd(10)}${RESET} -> ${WHITE}${cardName}${RESET} ${GRAY}[${cardNum}]${RESET} = ${YELLOW}${BOLD}${priceFormatted}${RESET}`);
    }
  } else {
    console.log(` ${GRAY}No recent price updates detected.${RESET}`);
  }

  // 3. PM2 & Worker Logs
  console.log(`\n${BOLD}${WHITE}📋 PM2 WORKER LOG TAIL${RESET}`);
  console.log(`${GRAY}-------------------------------------------------------------------------------${RESET}`);

  const dbfwLogs = await tailLogFile('logs/scraper-dbfw.log', 2);
  const opLogs = await tailLogFile('logs/scraper-en-op.log', 2);

  console.log(`${CYAN}${BOLD}[DBFW Scraper Log]${RESET}`);
  dbfwLogs.forEach(l => console.log(` ${GRAY}➜ ${l}${RESET}`));

  console.log(`\n${MAGENTA}${BOLD}[One Piece Scraper Log]${RESET}`);
  opLogs.forEach(l => console.log(` ${GRAY}➜ ${l}${RESET}`));

  console.log(`\n${GRAY}Press ${BOLD}Ctrl+C${RESET}${GRAY} to exit live feed.${RESET}\n`);
}

async function main() {
  await renderTerminalFeed();
  setInterval(renderTerminalFeed, 5000);
}

main().catch(err => {
  console.error(`${RED}Fatal Feed Error:${RESET}`, err);
  process.exit(1);
});
