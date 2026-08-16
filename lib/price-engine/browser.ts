import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

type SharedBrowser = Awaited<ReturnType<typeof puppeteer.launch>> & {
  connected?: boolean;
};

let sharedBrowser: SharedBrowser | null = null;
let launchPromise: Promise<SharedBrowser> | null = null;
let shutdownHandlersRegistered = false;
let shutdownPromise: Promise<void> | null = null;

function trackBrowser(browser: SharedBrowser): SharedBrowser {
  sharedBrowser = browser;
  browser.on('disconnected', () => {
    if (sharedBrowser === browser) {
      sharedBrowser = null;
    }
    // `disconnected` means the CDP transport dropped, NOT that Chrome exited — the
    // OS process (and its renderers/crashpad) can survive and orphan. Reap it so a
    // dropped connection doesn't leave a live browser behind on the next launch.
    const proc = browser.process();
    if (proc && proc.pid && proc.exitCode === null && !proc.killed) {
      try {
        proc.kill('SIGKILL');
      } catch {
        // best effort
      }
    }
  });
  return browser;
}

function isConnected(browser: SharedBrowser): boolean {
  // `connected` is available on Puppeteer's CDP browser implementation. The
  // event listener above remains the fallback for implementations without it.
  return browser.connected !== false;
}

// Close the shared browser and GUARANTEE the OS process is dead before nulling the
// reference. The old version nulled sharedBrowser first, then awaited an untimed
// browser.close(): if close() hung or threw, the reference was already gone so the
// next getSharedBrowser() launched a fresh Chrome while the old one lived on — a
// permanent orphan per failed close. That was the primary driver of the 279-process
// leak. Force-kill on timeout; only null the slot once the process is confirmed gone.
async function forceCloseBrowser(browser: SharedBrowser): Promise<void> {
  const proc = browser.process();
  // Race a graceful close against an 8s deadline. A hung close (stuck renderer /
  // ignored SIGTERM) is exactly the failure that orphaned Chrome before, so we never
  // await it unbounded.
  const graceful = browser.close().catch(() => {});
  const deadline = new Promise<void>((resolve) => setTimeout(resolve, 8000));
  await Promise.race([graceful, deadline]);

  // Whether close() resolved, threw, or timed out, SIGKILL the process if it is still
  // alive. SIGKILL can't be ignored the way Chrome's graceful SIGTERM path can hang.
  if (proc && proc.pid && proc.exitCode === null && !proc.killed) {
    try {
      proc.kill('SIGKILL');
    } catch {
      // best effort
    }
  }
}

export async function closeSharedBrowser(): Promise<void> {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    const browser = sharedBrowser || await launchPromise?.catch(() => null);
    if (browser) {
      await forceCloseBrowser(browser);
    }
    // Null only after the process is confirmed dead (close resolved or SIGKILL sent),
    // so a hung close can never leave a live Chrome unreferenced.
    sharedBrowser = null;
  })();

  try {
    await shutdownPromise;
  } finally {
    shutdownPromise = null;
  }
}

function registerShutdownHandlers(): void {
  if (shutdownHandlersRegistered) return;
  shutdownHandlersRegistered = true;

  const shutdown = () => {
    void closeSharedBrowser().finally(() => {
      process.exit(0);
    });
  };

  // Scraper workers are long-lived processes; PM2 sends SIGINT on shutdown.
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

export async function getSharedBrowser(): Promise<SharedBrowser> {
  registerShutdownHandlers();

  if (sharedBrowser && isConnected(sharedBrowser)) {
    return sharedBrowser;
  }

  if (launchPromise) {
    return launchPromise;
  }

  const pendingLaunch = puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }).then(trackBrowser);

  launchPromise = pendingLaunch;

  try {
    return await pendingLaunch;
  } finally {
    if (launchPromise === pendingLaunch) {
      launchPromise = null;
    }
  }
}
