import * as cheerio from 'cheerio';
import { connect } from 'puppeteer-real-browser';

async function main() {
  const queryNumber = process.argv[2] || 'OP05-119';
  console.log(`Searching PriceCharting for ${queryNumber} using puppeteer-real-browser...`);

  let browserInstance;
  try {
    const { browser, page } = await connect({
      headless: 'auto',
      turnstile: true,
      customConfig: {},
      disableXvfb: false,
    });
    browserInstance = browser;

    const searchUrl = `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(queryNumber + ' japanese')}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 4000));

    const html = await page.content();
    const $ = cheerio.load(html);

    console.log(`Page title: ${$('title').text()}`);

    // If redirected to product page
    if ($('#product_details').length > 0) {
      console.log(`Direct Product Page: ${page.url()}`);
      console.log(`Title: ${$('h1').text().trim()}`);
    } else {
      console.log(`Search Results:`);
      $('table#games_table tbody tr, table.hoverable-rows tbody tr').each((i, row) => {
        const titleLink = $(row).find('td.title a');
        const title = titleLink.text().trim();
        const href = titleLink.attr('href');
        const price = $(row).find('td.numeric, td.used_price').first().text().trim();
        if (title && href) {
          console.log(`  [${i+1}] ${title} | ${price} | https://www.pricecharting.com${href}`);
        }
      });
    }
  } catch (e) {
    console.error("Search error:", e);
  } finally {
    if (browserInstance) await browserInstance.close();
    process.exit(0);
  }
}

main();
