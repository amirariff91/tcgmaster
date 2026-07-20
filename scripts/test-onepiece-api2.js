const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('response', response => {
    const url = response.url();
    if (url.includes('json') || url.includes('api')) {
      console.log('API Request:', url);
    }
  });

  console.log('Navigating to onepiece.gg/tournaments...');
  await page.goto('https://onepiece.gg/tournaments/', { waitUntil: 'networkidle2' });
  
  await browser.close();
})();
