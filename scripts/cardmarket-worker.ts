import { getSharedBrowser, closeSharedBrowser } from '../lib/price-engine/browser';
import { dbQuery } from '../lib/db/client';
import { persistObservations, type PriceObservation } from '../lib/price-engine/write-path';
import * as cheerio from 'cheerio';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeCardmarketPage(url: string, card: any) {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  
  try {
    console.log(`[Cardmarket] Navigating to ${url}`);
    await page.setViewport({ width: 1280, height: 800 });
    
    // Mimic human behavior
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    if (response?.status() === 403) {
      console.log(`[Cardmarket] HTTP 403: Cloudflare blocked the request. You MUST run this on a residential IP.`);
      return;
    }

    // Wait a bit to ensure chart renders
    await delay(3000);

    const html = await page.content();
    const $ = cheerio.load(html);
    
    const observations: PriceObservation[] = [];

    // Cardmarket chart data is usually embedded in a script tag as a Chart.js configuration
    // We will search all script tags for date/price arrays.
    let chartDataRaw: string | null = null;
    $('script').each((_, el) => {
      const scriptContent = $(el).html();
      if (scriptContent && scriptContent.includes('Chart(') && scriptContent.includes('labels:')) {
        chartDataRaw = scriptContent;
      }
    });

    if (chartDataRaw) {
      console.log(`[Cardmarket] Found chart script block! Extracting historical points...`);
      // Basic regex to extract arrays. Cardmarket typically has labels (dates) and data (prices).
      const labelsMatch = chartDataRaw.match(/labels:\s*\[(.*?)\]/);
      const dataMatch = chartDataRaw.match(/data:\s*\[(.*?)\]/);
      
      if (labelsMatch && dataMatch) {
        const labels = labelsMatch[1].replace(/["']/g, '').split(',');
        const data = dataMatch[1].split(',');
        
        for (let i = 0; i < labels.length; i++) {
          const dateStr = labels[i].trim();
          const price = parseFloat(data[i].trim());
          
          if (!isNaN(price) && dateStr) {
            // Cardmarket dates are often DD.MM.YYYY
            const dateParts = dateStr.split('.');
            let recordedAt = new Date().toISOString();
            if (dateParts.length === 3) {
               recordedAt = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T12:00:00Z`).toISOString();
            }
            
            observations.push({
              source: 'cardmarket',
              grade: 'raw',
              priceUsd: price * 1.1, // Approximate EUR to USD conversion (you can make this dynamic later)
              priceNative: price,
              currency: 'EUR',
              recordedAt,
              evidence: {
                externalUrl: url,
                matchedBy: 'cached-url'
              }
            });
          }
        }
      }
    }

    // If chart extraction fails, fallback to current available price on the page
    if (observations.length === 0) {
      console.log(`[Cardmarket] No chart found. Falling back to current price element.`);
      const priceElementText = $('.price-container .color-primary, .info-list-container dt:contains("Trend Price") + dd').text();
      const match = priceElementText.match(/([0-9.,]+)\s*€/);
      
      if (match) {
        const price = parseFloat(match[1].replace(/,/g, '.'));
        if (!isNaN(price)) {
           observations.push({
              source: 'cardmarket',
              grade: 'raw',
              priceUsd: price * 1.1,
              priceNative: price,
              currency: 'EUR',
              recordedAt: new Date().toISOString(),
              evidence: {
                externalUrl: url,
                matchedBy: 'cached-url'
              }
           });
        }
      }
    }

    if (observations.length > 0) {
      console.log(`[Cardmarket] Saving ${observations.length} price observations for ${card.slug}...`);
      await persistObservations(dbQuery, card, observations);
    } else {
      console.log(`[Cardmarket] No prices found for ${card.slug}.`);
    }

  } catch (err) {
    console.error(`[Cardmarket] Error scraping ${url}:`, err);
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  console.log('[Cardmarket Worker] Starting local home worker...');
  
  // Fetch all cards that have a cardmarket_url mapped
  const cards = await dbQuery<any>(
    `SELECT id, slug, number, name, cardmarket_url FROM cards WHERE cardmarket_url IS NOT NULL`
  );

  console.log(`[Cardmarket Worker] Found ${cards.length} cards to process.`);

  for (const card of cards) {
    await scrapeCardmarketPage(card.cardmarket_url, card);
    // Be a good citizen, wait 10 seconds between requests
    await delay(10000); 
  }

  console.log('[Cardmarket Worker] Finished processing all cards.');
  await closeSharedBrowser();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
