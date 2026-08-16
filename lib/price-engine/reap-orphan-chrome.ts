import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Puppeteer gives its temporary profiles this prefix. Keep this match narrow so
// the reaper cannot affect browsers using a persistent or unrelated profile.
const PUPPETEER_PROFILE = /(?:^|\s)--user-data-dir=\/tmp\/puppeteer_dev_profile-[^\s]+(?:\s|$)/;
const CHROME_EXECUTABLE =
  /^(?:\S+\/)?(?:chrome|chrome-headless-shell|chromium|google-chrome(?:-stable)?)(?:\s|$)/i;

type ProcessInfo = {
  pid: number;
  parentPid: number;
  command: string;
};

let reapPromise: Promise<void> | null = null;

function parseProcess(line: string): ProcessInfo | null {
  const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/);
  if (!match) return null;

  return {
    pid: Number(match[1]),
    parentPid: Number(match[2]),
    command: match[3],
  };
}

function isOrphanedPuppeteerChrome(processInfo: ProcessInfo): boolean {
  return (
    processInfo.pid > 1 &&
    processInfo.pid !== process.pid &&
    processInfo.parentPid === 1 &&
    CHROME_EXECUTABLE.test(processInfo.command) &&
    PUPPETEER_PROFILE.test(processInfo.command)
  );
}

async function reapOrphanChrome(): Promise<void> {
  let stdout: string;

  try {
    const result = await execFileAsync('ps', ['-ww', '-eo', 'pid=,ppid=,args='], {
      maxBuffer: 1024 * 1024,
    });
    stdout = result.stdout.toString();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[price-engine] Could not inspect Chrome processes: ${message}`);
    return;
  }

  const orphanPids = stdout
    .split('\n')
    .map(parseProcess)
    .filter((processInfo): processInfo is ProcessInfo =>
      processInfo !== null && isOrphanedPuppeteerChrome(processInfo)
    )
    .map(({ pid }) => pid);

  const reapedPids: number[] = [];
  for (const pid of orphanPids) {
    try {
      process.kill(pid, 'SIGKILL');
      reapedPids.push(pid);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[price-engine] Could not kill orphan Chrome ${pid}: ${message}`);
    }
  }

  if (reapedPids.length > 0) {
    console.warn(
      `[price-engine] Reaped orphan Puppeteer Chrome process(es): ${reapedPids.join(', ')}`
    );
  }
}

// All callers in a worker share this promise, so startup cleanup runs once before
// the first browser launch even when several scraper tasks initialize concurrently.
export function reapOrphanChromeOnce(): Promise<void> {
  if (!reapPromise) {
    reapPromise = reapOrphanChrome().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[price-engine] Orphan Chrome cleanup failed: ${message}`);
    });
  }

  return reapPromise;
}
