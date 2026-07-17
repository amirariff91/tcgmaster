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
  });
  return browser;
}

function isConnected(browser: SharedBrowser): boolean {
  // `connected` is available on Puppeteer's CDP browser implementation. The
  // event listener above remains the fallback for implementations without it.
  return browser.connected !== false;
}

async function closeSharedBrowser(): Promise<void> {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    const browser = sharedBrowser || await launchPromise?.catch(() => null);
    sharedBrowser = null;

    if (browser) {
      await browser.close().catch(() => {});
    }
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
