import * as cheerio from 'cheerio';
import { getSharedBrowser } from '../../../lib/price-engine/browser';
import type { PopulationCard, PopulationDatabase } from './types';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

const SLEEP_MS = 15000;
const CGC_COMPANY_ID = 'dce6169f-8958-4229-861b-686a4644c984';

export async function scrapeCgc(card: PopulationCard, db: PopulationDatabase) {
  const searchQuery = `${card.name} ${card.number}`;
  console.log(`\n[CGC] Ingesting Population for ${card.slug}...`);

  let page: Awaited<ReturnType<Awaited<ReturnType<typeof getSharedBrowser>>['newPage']>> | undefined;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    console.log(`  -> Loading CGC Pop Report search...`);
    await page.goto('https://www.cgccards.com/population-report/', { waitUntil: 'domcontentloaded', timeout: 45000 });

    await new Promise(r => setTimeout(r, 2000));

    const searchBox = await page.$('input[name="search"], input[type="search"]');
    if (searchBox) {
       console.log(`  -> Submitting search query...`);
       await searchBox.type(searchQuery);
       await Promise.all([
          page.keyboard.press('Enter'),
          new Promise(r => setTimeout(r, 5000))
       ]);
    }

    const html = await page.content();
    const $ = cheerio.load(html);

    let popUrl: string | null = null;
    $('a').each((_, el) => {
       const href = $(el).attr('href');
       const text = $(el).text().toLowerCase();
       if (href && href.includes('/population-report/') && text.includes(card.number.toLowerCase())) {
          popUrl = href.startsWith('http') ? href : `https://www.cgccards.com${href}`;
       }
    });

    if (!popUrl) {
       console.log(`  ✗ Could not find direct pop report link in search results.`);
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
       if (text.includes('10') || text.includes('9.5') || text.includes('pristine')) {
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
    totalPop = Object.values(gradeCounts).reduce((sum, count) => sum + count, 0);

    if (Object.keys(gradeCounts).length > 0) {
       for (const [grade, count] of Object.entries(gradeCounts)) {
           if (count > 0) {
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
                   [card.id, CGC_COMPANY_ID, numericGrade, count, totalPop, new Date().toISOString(), popUrl],
                 );
               } catch (popError) {
                 const message = popError instanceof Error ? popError.message : String(popError);
                 console.error(`  ✗ population_reports upsert failed: ${message}`);
                 return false;
               }
           }
       }
       console.log(`  ✓ Inserted CGC population data (Total Pop: ${totalPop})`);
    } else {
       console.log(`  ✗ No matching population rows found in the table.`);
    }

    return true;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  ! Error scraping CGC: ${message}`);
    return false;
  } finally {
    // Close the tab on EVERY exit path — navigation timeouts previously leaked the
    // page's renderer process here. `?.` guards newPage() itself throwing.
    await page?.close().catch(() => {});
  }
}
