import { getSharedBrowser } from "../lib/price-engine/browser";
import * as cheerio from "cheerio";

async function test() {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");
  
  const url = "https://www.pricecharting.com/game/one-piece-japanese-awakening-of-the-new-era/monkeydluffy-alternate-art-manga-op05-119";
  console.log("Loading URL:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.content();
  const $ = cheerio.load(html);
  console.log("Page title:", $("title").text().trim());
  console.log("Price box:", $("#used_price .price").text().trim());
  console.log("Completed rows:", $(".completed-auctions-used table tbody tr").length);
  await page.close();
  process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
