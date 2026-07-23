import { execSync, spawn } from 'child_process';
import path from 'path';

function isPM2AppRunning(appName: string): boolean {
  try {
    const raw = execSync('pm2 jlist 2>/dev/null', { timeout: 2000 }).toString();
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return false;
    return list.some((proc: any) => proc.name === appName && proc.pm2_env?.status === 'online');
  } catch {
    return false;
  }
}

function startPM2Ecosystem() {
  console.log('\x1b[36m\x1b[1m🚀 Launching TCGMaster PM2 24/7 Workers...\x1b[0m');
  try {
    const configPath = path.join(process.cwd(), 'ecosystem.config.cjs');
    execSync(`pm2 start ${configPath}`, { stdio: 'inherit' });
  } catch (e) {
    console.error('\x1b[31mFailed to start PM2 ecosystem:\x1b[0m', e);
  }
}

function main() {
  const primaryApp = 'scraper-en-op';
  if (!isPM2AppRunning(primaryApp)) {
    startPM2Ecosystem();
  }

  console.log('\x1b[32m\x1b[1mOpening PM2 Interactive Terminal Monitor...\x1b[0m\n');

  // Spawn official native PM2 monit with inherited stdio for full TUI interactive terminal session
  const monit = spawn('pm2', ['monit'], { stdio: 'inherit' });

  monit.on('error', (err) => {
    console.error('\x1b[31mFailed to launch pm2 monit:\x1b[0m', err);
    process.exit(1);
  });

  monit.on('exit', (code) => {
    process.exit(code || 0);
  });
}

main();
