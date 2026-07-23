import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const GRAY = '\x1b[90m';
const WHITE = '\x1b[97m';
const ERASE_LINE = '\x1b[K';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(`${RED}${BOLD}Error:${RESET} Supabase environment variables missing in .env / .env.local`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface PM2Process {
  pm_id: number;
  name: string;
  pm2_env: {
    status: string;
    restart_time: number;
    pm_uptime: number;
  };
  monit: {
    memory: number;
    cpu: number;
  };
}

let isPM2Running = false;

function getPM2Processes(): Map<string, PM2Process> {
  const map = new Map<string, PM2Process>();
  try {
    const raw = execSync('pm2 jlist 2>/dev/null', { timeout: 1500 }).toString();
    const list: PM2Process[] = JSON.parse(raw);
    if (list && list.length > 0) {
      isPM2Running = true;
      for (const proc of list) {
        map.set(proc.name, proc);
      }
    } else {
      isPM2Running = false;
    }
  } catch {
    isPM2Running = false;
  }
  return map;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

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
  if (source === 'tcgplayer') return `$${price.toFixed(2)}`;
  return `¥${price.toLocaleString()}`;
}

async function tailLogFile(relativePath: string, linesCount = 2): Promise<string[]> {
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

// Fixed width column padding utility
function pad(str: string, length: number, alignRight = false): string {
  const plain = str.replace(/\x1b\[[0-9;]*m/g, '');
  const spaceNeeded = Math.max(0, length - plain.length);
  const padding = ' '.repeat(spaceNeeded);
  return alignRight ? padding + str : str + padding;
}

// Buffer accumulator to prevent flickers
let outputBuffer = '';
function printLine(line = '') {
  outputBuffer += line + ERASE_LINE + '\n';
}

async function renderPM2Dashboard() {
  outputBuffer = ''; // Reset buffer
  const now = new Date().toLocaleTimeString();
  const pm2Map = getPM2Processes();

  const pm2Badge = isPM2Running
    ? `${GREEN}${BOLD}PM2 DAEMON: ACTIVE${RESET}`
    : `${YELLOW}${BOLD}PM2 OFFLINE (Run: pm2 start ecosystem.config.cjs)${RESET}`;

  printLine(`${CYAN}${BOLD}┌──────────────────────────────────────────────────────────────────────────────────────────┐${RESET}`);
  printLine(`${CYAN}${BOLD}│ 🚀 TCGMASTER MISSION CONTROL & PM2 DASHBOARD                   ${GRAY}Refreshed: ${now.padEnd(11)}${CYAN}${BOLD}│${RESET}`);
  printLine(`${CYAN}${BOLD}│    Status: ${pad(pm2Badge, 78)} ${CYAN}${BOLD}│${RESET}`);
  printLine(`${CYAN}${BOLD}└──────────────────────────────────────────────────────────────────────────────────────────┘${RESET}`);

  // All 8 App Workers Inventory
  const appConfigs = [
    { id: '00', name: 'scraper-en-op', dbSource: 'tcgplayer' },
    { id: '01', name: 'scraper-jp-op', dbSource: 'yuyutei' },
    { id: '02', name: 'scraper-dbfw',  dbSource: 'cardrush' },
    { id: '03', name: 'scraper-en-dbfw', dbSource: 'tcgplayer' },
    { id: '04', name: 'artist-vision', dbSource: null },
    { id: '05', name: 'variant-mapper', dbSource: null },
    { id: '06', name: 'deck-prices',   dbSource: null },
    { id: '07', name: 'image-downloader', dbSource: null },
  ];

  // 1. Process Table Header
  printLine(`${WHITE}${BOLD}┌────┬────────────────────┬──────────┬──────────┬───────────┬──────────┬────────────────┐${RESET}`);
  printLine(`${WHITE}${BOLD}│ id │ App Name           │ Status   │ CPU      │ Memory    │ Restarts │ Last Sync      │${RESET}`);
  printLine(`${WHITE}${BOLD}├────┼────────────────────┼──────────┼──────────┼───────────┼──────────┼────────────────┤${RESET}`);

  for (const app of appConfigs) {
    const pm2Info = pm2Map.get(app.name);

    let statusBadge = `${GRAY}stopped  ${RESET}`;
    if (pm2Info) {
      if (pm2Info.pm2_env.status === 'online') {
        statusBadge = `${GREEN}${BOLD}online   ${RESET}`;
      } else {
        statusBadge = `${RED}${BOLD}${pm2Info.pm2_env.status.padEnd(9)}${RESET}`;
      }
    } else {
      statusBadge = `${YELLOW}${BOLD}idle     ${RESET}`;
    }

    const cpuStr = pm2Info ? `${pm2Info.monit.cpu.toFixed(1)}%` : '0.0%';
    const memStr = pm2Info ? formatBytes(pm2Info.monit.memory) : 'N/A';
    const restartsStr = pm2Info ? String(pm2Info.pm2_env.restart_time) : '0';

    let lastSyncStr = 'N/A';
    if (app.dbSource) {
      const { data } = await supabase
        .from('price_history')
        .select('recorded_at')
        .eq('source', app.dbSource)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const dateStr = (data as { recorded_at: string } | null)?.recorded_at;
      if (dateStr) {
        lastSyncStr = formatShortTime(new Date(dateStr));
      }
    }

    const colId = pad(app.id, 2);
    const colName = pad(app.name, 18);
    const colStatus = pad(statusBadge, 8);
    const colCpu = pad(cpuStr, 8);
    const colMem = pad(memStr, 9);
    const colRestarts = pad(restartsStr, 8);
    const colSync = pad(lastSyncStr, 14);

    printLine(`│ ${colId} │ ${colName} │ ${colStatus} │ ${colCpu} │ ${colMem} │ ${colRestarts} │ ${colSync} │`);
  }

  printLine(`${WHITE}${BOLD}└────┴────────────────────┴──────────┴──────────┴───────────┴──────────┴────────────────┘${RESET}`);

  // 2. Live Price Stream Box
  printLine(`\n${CYAN}${BOLD}┌──────────────────────────────────────────────────────────────────────────────────────────┐${RESET}`);
  printLine(`${CYAN}${BOLD}│ ⚡ LIVE RECENT PRICE UPDATES STREAM (Latest 6)                                           │${RESET}`);
  printLine(`${CYAN}${BOLD}├──────────────────────────────────────────────────────────────────────────────────────────┤${RESET}`);

  const { data: recentPrices } = await supabase
    .from('price_history')
    .select('source, price, recorded_at, cards(name, number)')
    .order('recorded_at', { ascending: false })
    .limit(6);

  if (recentPrices && recentPrices.length > 0) {
    for (const item of recentPrices as any[]) {
      const timeStr = item.recorded_at ? formatShortTime(new Date(item.recorded_at)) : 'N/A';
      const cardName = (item.cards?.name || 'Unknown Card').substring(0, 32);
      const cardNum = item.cards?.number || '?';
      const priceFormatted = formatPrice(item.price || 0, item.source);
      const sourceCol = item.source === 'tcgplayer' ? MAGENTA : CYAN;

      const line = `${GRAY}[${timeStr.padStart(7)}]${RESET} ${sourceCol}${item.source.toUpperCase().padEnd(10)}${RESET} ➜ ${WHITE}${cardName}${RESET} ${GRAY}[${cardNum}]${RESET} = ${YELLOW}${BOLD}${priceFormatted}${RESET}`;
      printLine(`│ ${pad(line, 88)} │`);
    }
  } else {
    printLine(`│ ${GRAY}No recent price updates detected.${' '.repeat(55)}${RESET} │`);
  }
  printLine(`${CYAN}${BOLD}└──────────────────────────────────────────────────────────────────────────────────────────┘${RESET}`);

  // 3. PM2 Log Tail Box
  printLine(`\n${MAGENTA}${BOLD}┌──────────────────────────────────────────────────────────────────────────────────────────┐${RESET}`);
  printLine(`${MAGENTA}${BOLD}│ 📋 LIVE PM2 WORKER LOG TAIL                                                              │${RESET}`);
  printLine(`${MAGENTA}${BOLD}├──────────────────────────────────────────────────────────────────────────────────────────┤${RESET}`);

  const dbfwLogs = await tailLogFile('logs/scraper-dbfw.log', 2);
  const opLogs = await tailLogFile('logs/scraper-en-op.log', 2);

  printLine(`│ ${CYAN}${BOLD}[scraper-dbfw]${RESET}${' '.repeat(73)} │`);
  dbfwLogs.forEach(l => printLine(`│   ${GRAY}➜ ${l.substring(0, 80)}${RESET}${' '.repeat(Math.max(0, 83 - l.substring(0, 80).length))} │`));

  printLine(`│ ${MAGENTA}${BOLD}[scraper-en-op]${RESET}${' '.repeat(71)} │`);
  opLogs.forEach(l => printLine(`│   ${GRAY}➜ ${l.substring(0, 80)}${RESET}${' '.repeat(Math.max(0, 83 - l.substring(0, 80).length))} │`));

  printLine(`${MAGENTA}${BOLD}└──────────────────────────────────────────────────────────────────────────────────────────┘${RESET}`);
  printLine(` ${GRAY}Run ${BOLD}pm2 start ecosystem.config.cjs${RESET} ${GRAY}to start all workers in 24/7 background. Press ${BOLD}Ctrl+C${RESET} ${GRAY}to exit.${RESET}`);

  // ZERO FLICKER: Move cursor to home (row 1, col 1) and output buffer in-place
  process.stdout.write('\x1b[H' + outputBuffer);
}

function restoreTerminal() {
  process.stdout.write('\x1b[?25h\x1b[0m\n'); // Show cursor & reset text styling
}

async function main() {
  process.stdout.write('\x1b[?25l\x1b[2J\x1b[H'); // Hide cursor & initial clear

  process.on('SIGINT', () => {
    restoreTerminal();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    restoreTerminal();
    process.exit(0);
  });

  process.on('uncaughtException', (err) => {
    restoreTerminal();
    console.error("Uncaught Error:", err);
    process.exit(1);
  });

  await renderPM2Dashboard();
  setInterval(renderPM2Dashboard, 3000);
}

main().catch(err => {
  restoreTerminal();
  console.error(`${RED}Fatal Feed Error:${RESET}`, err);
  process.exit(1);
});
