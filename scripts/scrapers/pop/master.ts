import fs from 'fs';
import os from 'os';
import path from 'path';
import { createScraperClient } from '../../../lib/price-engine/db';

// Import our refactored scraping functions
import { scrapePsa } from './psa';
import { scrapeBgs } from './bgs';
import { scrapeCgc } from './cgc';
import { scrapeTag } from './tag';
import type { PsaCookie, PopulationCard } from './types';

import 'dotenv/config';

const db = createScraperClient();

const SLEEP_MS = 20000;

async function run() {
  console.log(`Starting MASTER Population Scraper Worker...`);

  const cookiePath = process.env.PSA_COOKIE_PATH ?? path.join(os.homedir(), '.tcgmaster', 'psa-cookies.json');
  let cookies: PsaCookie[] = [];
  if (!fs.existsSync(cookiePath)) {
    console.error(`WARNING: psa-cookies.json not found at ${cookiePath}! PSA will likely fail without session cookies.`);
  } else {
    cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8')) as PsaCookie[];
  }

  const trackerPath = path.join(__dirname, '..', '..', 'population-tracker-master.json');
  let tracker: Record<string, string> = {};
  if (fs.existsSync(trackerPath)) {
     tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
  }

  while (true) {
    let cards: PopulationCard[] = [];
    try {
      // Fetch a batch of cards
      const data = await db(
        `SELECT c.id, c.name, c.slug, c.number,
                CASE WHEN s.id IS NULL THEN NULL ELSE json_build_object('name', s.name) END AS sets
         FROM cards c
         LEFT JOIN sets s ON s.id = c.set_id
         LIMIT 1000`,
      ) as PopulationCard[];
      // Sort by least recently updated in tracker
      cards = data.sort((a, b) => {
         const timeA = tracker[a.id] ? new Date(tracker[a.id]).getTime() : 0;
         const timeB = tracker[b.id] ? new Date(tracker[b.id]).getTime() : 0;
         return timeA - timeB;
      }).slice(0, 1);
    } catch (e) {
      console.error('Error fetching cards:', e);
    }

    if (cards.length === 0) {
      console.log('No cards found. Sleeping...');
      await new Promise(r => setTimeout(r, SLEEP_MS));
      continue;
    }

    const card = cards[0] as PopulationCard;
    console.log(`\n======================================================`);
    console.log(`MASTER WORKER: Processing Population for ${card.slug}`);
    console.log(`======================================================`);

    try {
      // Run them sequentially. They all share the same singleton browser instance!
      // This prevents OOM crashes and reduces concurrent Cloudflare rate limits.

      const psaSuccess = await scrapePsa(card, db, cookies);
      await new Promise(r => setTimeout(r, 5000)); // Delay between companies

      const bgsSuccess = await scrapeBgs(card, db);
      await new Promise(r => setTimeout(r, 5000));

      const cgcSuccess = await scrapeCgc(card, db);
      await new Promise(r => setTimeout(r, 5000));

      const tagSuccess = await scrapeTag(card, db);

    } catch (e) {
       console.error(`Master worker loop error:`, e);
    }

    // Update local tracker
    tracker[card.id] = new Date().toISOString();
    fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));

    console.log(`\nFinished processing ${card.slug}. Sleeping...`);
    await new Promise(r => setTimeout(r, SLEEP_MS));
  }
}

run();
