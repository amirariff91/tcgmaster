import * as cheerio from 'cheerio';
const response = await fetch('https://www.dbs-cardgame.com/fw/en/cardlist/?search=true&category=428001&txt=FB01-136');
const html = await response.text();
const $ = cheerio.load(html);
const img = $('.cardlist-modal-inner img').attr('src') || $('.cardlist-list img').first().attr('src');
console.log('Image URL:', img);
