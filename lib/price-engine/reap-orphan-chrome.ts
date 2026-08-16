import { readdirSync, readFileSync } from 'node:fs';

// App-specific marker: only Chrome launched by THIS scraper carries this
// user-data-dir (see getSharedBrowser). Anything else — a human's browser,
// another tenant's Chrome — is never touched.
const APP_MARKER = '--user-data-dir=/tmp/puppeteer_dev_profile-tcgmaster-';

let reaped = false;

// Parse /proc/<pid>/stat. The comm field is wrapped in parens and may itself
// contain spaces/parens, so we split on the LAST ')' and parse the fields that
// follow it. After comm: fields[0]=state, fields[1]=ppid, fields[19]=starttime
// (overall field 22). Returns { ppid, starttime } or null on malformed input.
function parseStat(stat: string): { ppid: number; starttime: string } | null {
  const close = stat.lastIndexOf(')');
  if (close === -1) return null;
  const rest = stat.slice(close + 1).trim();
  if (!rest) return null;
  const fields = rest.split(/\s+/);
  if (fields.length < 20) return null;
  const ppid = Number(fields[1]);
  if (!Number.isInteger(ppid) || ppid < 0) return null;
  return { ppid, starttime: fields[19] };
}

// Read /proc/<pid>/cmdline (NUL-separated argv) and report whether it carries
// the app marker. Returns false on any read error (process may have exited).
function hasAppMarker(pid: number): boolean {
  try {
    return readFileSync(`/proc/${pid}/cmdline`).includes(APP_MARKER);
  } catch {
    return false;
  }
}

// Reap Chrome orphaned by a crash path (uncaught worker exit, SIGKILL'd parent,
// dropped CDP) where the browser process survived reparented to init. Runs
// exactly once per process. Never throws: the worker must start even if reaping
// fails. Runs BEFORE this worker launches its own browser, and only kills
// PPID==1 orphans, so it can never touch a live worker's browser.
export async function reapOrphanChromeOnce(): Promise<void> {
  if (reaped) return;
  reaped = true;

  try {
    const pids = readdirSync('/proc').filter((p) => /^\d+$/.test(p));
    for (const pidStr of pids) {
      const pid = Number(pidStr);
      if (pid === process.pid) continue; // never kill self

      if (!hasAppMarker(pid)) continue;

      let stat: string;
      try {
        stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      } catch {
        continue; // exited between reads
      }
      const parsed = parseStat(stat);
      if (!parsed) continue;
      if (parsed.ppid !== 1) continue; // still owned by a live worker — leave it

      // PID-REUSE GUARD: the pid could be recycled between the scan and the
      // kill. Re-read and require ppid still 1, starttime unchanged, and the
      // marker still present, so we can never SIGKILL a process that inherited
      // the pid.
      let stat2: string;
      try {
        stat2 = readFileSync(`/proc/${pid}/stat`, 'utf8');
      } catch {
        continue;
      }
      const parsed2 = parseStat(stat2);
      if (!parsed2) continue;
      if (parsed2.ppid !== 1) continue;
      if (parsed2.starttime !== parsed.starttime) continue; // pid reused
      if (!hasAppMarker(pid)) continue; // cmdline changed — pid reused

      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // already dead or no permission — best effort
      }
    }
  } catch {
    // Never throw: the worker must start even if reaping fails.
  }
}
