import puppeteer from 'puppeteer';

async function run() {
  console.log("Launching Puppeteer...");
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Go to search page
  console.log("Navigating to SNKRDUNK...");
  await page.goto('https://snkrdunk.com/en/search/result?keyword=OP01-120', { waitUntil: 'networkidle2' });
  
  const html = await page.content();
  
  // Find product links
  const links = await page.$$eval('a', as => as.map(a => a.href).filter(href => href.includes('/products/')));
  console.log("Found links:", links);
  
  if (links.length > 0) {
    console.log(`Navigating to ${links[0]}...`);
    await page.goto(links[0], { waitUntil: 'networkidle2' });
    
    const priceText = await page.evaluate(() => {
      // SNKRDUNK lists recent sales in a table or list usually
      const sales = Array.from(document.querySelectorAll('*')).find(el => el.textContent?.includes('Recent Transactions') || el.textContent?.includes('Last Sold'));
      if (sales && sales.parentElement) {
        return sales.parentElement.innerText;
      }
      return document.body.innerText.substring(0, 1000);
    });
    console.log("Extracted page content length:", priceText.length);
    console.log("Preview:\n", priceText.substring(0, 300));
  }
  
  await browser.close();
}
run();
