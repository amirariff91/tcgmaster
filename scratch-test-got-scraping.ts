import { gotScraping } from 'got-scraping';

async function main() {
  const url = 'https://www.pricecharting.com/game/one-piece-japanese-romance-dawn/shanks-alternate-art-manga-op01-120';
  console.log('Testing CF bypass on URL:', url);
  
  try {
    const response = await gotScraping({
      url,
      headerGeneratorOptions: {
        browsers: [{ name: 'chrome', minVersion: 120 }],
        devices: ['desktop'],
        locales: ['en-US']
      }
    });
    
    if (response.body.includes('table.hoverable-striped') || response.body.toLowerCase().includes('shanks')) {
      if (response.body.includes('Just a moment')) {
        console.log('FAILED! Blocked by Cloudflare (Just a moment...)');
      } else {
        console.log('SUCCESS! Bypassed Cloudflare with got-scraping!');
      }
    } else {
      console.log('Unknown response. Length:', response.body.length);
    }
  } catch (error: any) {
    console.error('Error fetching:', error.message);
    if (error.response?.body?.includes('Just a moment')) {
      console.log('FAILED! Blocked by Cloudflare (403)');
    }
  }
  process.exit(0);
}

main();
