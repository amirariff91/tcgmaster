import * as cheerio from 'cheerio';
import { getSharedBrowser } from '../../../lib/price-engine/browser';
import type { PopulationCard, PopulationDatabase } from './types';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

const SLEEP_MS = 15000;
const BGS_COMPANY_ID = 'cda2045f-5d78-49e7-b1c8-de04dac9888d';

export async function scrapeBgs(card: PopulationCard, db: PopulationDatabase) {
  const searchQuery = `${card.name} ${card.number}`;
  console.log(`\n[BGS] Ingesting Population for ${card.slug}...`);

  try {
    const browser = await getSharedBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    console.log(`  -> Loading BGS Pop Report search...`);
    await page.goto('https://www.beckett.com/grading/pop-report', { waitUntil: 'domcontentloaded', timeout: 45000 });

    await new Promise(r => setTimeout(r, 2000));

    const searchInput = await page.$('input[name="search_term"]');
    if (searchInput) {
       console.log(`  -> Submitting search query...`);
       await searchInput.type(searchQuery);
       await Promise.all([
          page.click('input[type="submit"], button[type="submit"]'),
          page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {})
       ]);
    }

    const html = await page.content();
    const $ = cheerio.load(html);

    let popUrl: string | null = null;
    $('a').each((_, el) => {
       const href = $(el).attr('href');
       const text = $(el).text().toLowerCase();
       if (href && href.includes('/grading/pop-report/') && text.includes(card.number.toLowerCase())) {
          popUrl = href.startsWith('http') ? href : `https://www.beckett.com${href}`;
       }
    });

    if (!popUrl) {
       console.log(`  ✗ Could not find direct pop report link in search results.`);
       await page.close();
       return true; // Success (no data found)
    }

    console.log(`  -> Navigating to exact Pop Report: ${popUrl}`);
    await page.goto(popUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));

    const popHtml = await page.content();
    const $pop = cheerio.load(popHtml);

    let totalPop = 0;
    const gradeCounts: Record<string, number> = {};

    $pop('tr').each((_, tr) => {
       const text = $pop(tr).text().toLowerCase();
       if (text.includes('10') || text.includes('9.5')) {
          const cells = $pop(tr).find('td');
          if (cells.length > 2) {
             const gradeText = $pop(cells[0]).text().trim();
             const countText = $pop(cells[cells.length - 1]).text().replace(/\D/g, '');
             if (gradeText && countText) {
                gradeCounts[gradeText] = parseInt(countText || '0');
             }
          }
       }
    });

    if (Object.keys(gradeCounts).length > 0) {
       for (const [grade, count] of Object.entries(gradeCounts)) {
           if (count > 0) {
               totalPop += count;
               const numericGrade = Number(grade);
               if (!Number.isFinite(numericGrade)) continue;
               try {
                 await db(
                   `INSERT INTO population_reports (
                      card_id, grading_company_id, grade, count, total_population, scraped_at, source_url
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (card_id, grading_company_id, grade) DO UPDATE SET
                      count = EXCLUDED.count,
                      total_population = EXCLUDED.total_population,
                      scraped_at = EXCLUDED.scraped_at,
                      source_url = EXCLUDED.source_url`,
                   [card.id, BGS_COMPANY_ID, numericGrade, count, totalPop, new Date().toISOString(), popUrl],
                 );
               } catch (popError) {
                 const message = popError instanceof Error ? popError.message : String(popError);
                 console.error(`  ✗ population_reports upsert failed: ${message}`);
                 return false;
               }
           }
       }
       console.log(`  ✓ Inserted BGS population data (Total Pop: ${totalPop})`);
    } else {
       console.log(`  ✗ No matching population rows found in the table.`);
    }

    await page.close();
    return true;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  ! Error scraping BGS: ${message}`);
    return false;
  }
}
