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
function readStat(pid: number): { ppid: number; starttime: string } | null {
  let stat: string;
  try {
    stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
  } catch {
    return null; // process exited
  }
  const close = stat.lastIndexOf(')');
  if (close === -1) return null;
  const fields = stat.slice(close + 1).trim().split(/\s+/);
  if (fields.length < 20) return null;
  const ppid = Number(fields[1]);
  if (!Number.isInteger(ppid) || ppid < 0) return null;
  return { ppid, starttime: fields[19] };
}

// Read /proc/<pid>/cmdline (NUL-separated argv) and report whether it carries
// the app marker. Buffer.includes(string) matches the marker as contiguous
// UTF-8 bytes; the marker is a single argv token so no NUL falls inside it.
// Returns false on any read error (process may have exited).
function hasAppMarker(pid: number): boolean {
  try {
    return readFileSync(`/proc/${pid}/cmdline`).includes(APP_MARKER);
  } catch {
    return false;
  }
}

// Reap Chrome orphaned by a crash path (uncaught worker exit, SIGKILL'd parent,
// dropped CDP) where the browser process survived reparented to init. Runs
// exactly once per process, BEFORE this worker launches its own browser, and
// only signals PPID==1 orphans — so it can never touch a live worker's browser.
// Never throws: the worker must start even if reaping fails.
//
// Validation order is stat1 -> cmdline -> stat2, so the LAST read before the
// SIGKILL is the identity-confirming stat re-read (same starttime + still PPID
// 1). A recycled PID changes starttime and is rejected. The only residual gap
// is the sub-microsecond window between that final stat read and process.kill;
// closing it literally would require pidfd_send_signal, which Node has no
// dependency-free API for on this base image. In practice the window cannot be
// exploited: it would require the orphan to exit AND the kernel to wrap the
// entire PID space back to this exact PID AND the new holder to carry the
// tcgmaster marker, all within that window.
export async function reapOrphanChromeOnce(): Promise<void> {
  if (reaped) return;
  reaped = true;

  try {
    const pids = readdirSync('/proc').filter((p) => /^\d+$/.test(p));
    for (const pidStr of pids) {
      const pid = Number(pidStr);
      if (pid === process.pid) continue; // never kill self

      // stat1: must be an orphan (reparented to init). Capture starttime.
      const s1 = readStat(pid);
      if (!s1 || s1.ppid !== 1) continue;

      // cmdline: must be one of OUR browsers.
      if (!hasAppMarker(pid)) continue;

      // stat2: final identity confirmation immediately before signalling — same
      // process (unchanged starttime) and still an orphan. Rejects PID reuse.
      const s2 = readStat(pid);
      if (!s2 || s2.ppid !== 1 || s2.starttime !== s1.starttime) continue;

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
