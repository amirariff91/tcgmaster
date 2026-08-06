import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import os from 'os';
import path from 'path';

puppeteer.use(StealthPlugin());

async function run() {
  console.log('Launching browser for you to log in...');

  // Launch visibly so the user can interact
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  console.log('Navigating to PSA Login...');
  await page.goto('https://www.psacard.com/myaccount/login', { waitUntil: 'domcontentloaded' });

  console.log('\n--- ACTION REQUIRED ---');
  console.log('Please log into PSA in the browser window that just opened.');
  console.log('After you successfully log in and see your dashboard/account page, return to this terminal and press ENTER to save your session.');

  // Wait for user to press ENTER in the terminal
  process.stdin.once('data', async () => {
    console.log('Saving session cookies...');

    const cookies = await page.cookies();
    const cookiePath = process.env.PSA_COOKIE_PATH ?? path.join(os.homedir(), '.tcgmaster', 'psa-cookies.json');
    fs.mkdirSync(path.dirname(cookiePath), { recursive: true });

    fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2));

    console.log(`\n✅ Success! Your login session has been saved to: ${cookiePath}`);
    console.log('The headless scraper will now be able to use these cookies to bypass the login screen.');

    await browser.close();
    process.exit(0);
  });
}

run();
