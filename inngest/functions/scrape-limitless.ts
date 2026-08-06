import { inngest } from '../client';
import * as cheerio from 'cheerio';
import { dbQuery } from '@/lib/db/client';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const syncLimitlessTournaments = inngest.createFunction(
  { id: 'sync-limitless-tournaments' },
  { cron: '0 */12 * * *' }, // Run every 12 hours
  async ({ step }) => {
    // 1. Fetch tournaments list
    const tournaments = await step.run('fetch-tournaments-list', async () => {
      const res = await fetch('https://onepiece.limitlesstcg.com/tournaments');
      const html = await res.text();
      const $ = cheerio.load(html);
      
      const results: any[] = [];
      $('table.completed-tournaments tbody tr').each((i, el) => {
        const name = $(el).find('td:nth-child(3) a').text().trim();
        let url = $(el).find('td:nth-child(3) a').attr('href');
        const dateStr = $(el).find('td:nth-child(1)').text().trim();
        const playersStr = $(el).find('td:nth-child(6)').text().trim();
        
        if (name && url) {
          if (url.startsWith('/')) url = `https://onepiece.limitlesstcg.com${url}`;
          
          results.push({
            name,
            url,
            date: new Date(dateStr).toISOString(),
            format: 'Standard',
            players: parseInt(playersStr.replace(/[^0-9]/g, ''), 10) || 0
          });
        }
      });
      return results;
    });

    // 2. Fetch One Piece Game ID
    const gameId = await step.run('get-game-id', async () => {
      const rows = await dbQuery(
        `SELECT id FROM games WHERE slug = $1 LIMIT 1`,
        ['one-piece'],
      ) as Array<{ id: string }>;
      return rows[0]?.id;
    });

    if (!gameId) return { message: 'One Piece game not found' };

    // 3. Process each tournament sequentially to be polite
    for (const t of tournaments.slice(0, 5)) {
      const tournamentId = await step.run(`sync-tournament-${t.url}`, async () => {
        const existingRows = await dbQuery(
          `SELECT id FROM tournaments WHERE source_url = $1 LIMIT 1`,
          [t.url],
        ) as Array<{ id: string }>;
        if (existingRows[0]) return existingRows[0].id; // Already processed

        const insertedRows = await dbQuery(
          `INSERT INTO tournaments (name, date, format, num_players, source_url, game_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [t.name, t.date, t.format, t.players, t.url, gameId],
        ) as Array<{ id: string }>;
        return insertedRows[0]?.id ?? null;
      });

      if (!tournamentId) continue;

      // 4. Fetch decks for this tournament
      await step.run(`fetch-decks-${tournamentId}`, async () => {
        await delay(3000); 

        const res = await fetch(t.url);
        const html = await res.text();
        const $ = cheerio.load(html);

        const deckUrls: any[] = [];
        $('.tournament-results tbody tr').slice(0, 16).each((i, el) => {
          const placement = $(el).find('td:nth-child(1)').text().trim();
          const player = $(el).find('td:nth-child(2) a').text().trim();
          let deckUrl = $(el).find('td:nth-child(4) a').attr('href');
          
          if (deckUrl) {
            if (deckUrl.startsWith('/')) deckUrl = `https://onepiece.limitlesstcg.com${deckUrl}`;
            deckUrls.push({ placement, player, deckUrl });
          }
        });

        for (const d of deckUrls) {
          const existingDeckRows = await dbQuery(
            `SELECT id FROM decks WHERE source_url = $1 LIMIT 1`,
            [d.deckUrl],
          ) as Array<{ id: string }>;
          if (existingDeckRows[0]) continue;

          await delay(3000);
          const dRes = await fetch(d.deckUrl);
          const dHtml = await dRes.text();
          const $d = cheerio.load(dHtml);

          const cards: any[] = [];
          $d('.decklist-card').each((i, el) => {
            const countStr = $d(el).attr('data-count');
            const rawId = $d(el).attr('data-id');
            let name = $d(el).find('.card-name').text().trim();
            // Remove the (OPXX-XXX) from the end of the name if present
            name = name.replace(/\s*\([a-zA-Z0-9-]+\)\s*$/, '');
            
            if (countStr && rawId) {
              cards.push({ count: parseInt(countStr, 10) || 1, rawId, name });
            }
          });

          // If no cards were found, skip inserting the deck
          if (cards.length === 0) continue;

          const insertedDeckRows = await dbQuery(
            `INSERT INTO decks (tournament_id, player_name, placement, source_url)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [tournamentId, d.player, d.placement, d.deckUrl],
          ) as Array<{ id: string }>;
          const insertedDeck = insertedDeckRows[0];

          if (insertedDeck) {
            let leaderCardId = null;

            for (const c of cards) {
              const guessSlug = `op-${c.rawId.toLowerCase()}`;
              // Try exactly
              let matchedCard = (await dbQuery(
                `SELECT id FROM cards WHERE slug = $1 LIMIT 1`,
                [guessSlug],
              ) as Array<{ id: string }>)[0] ?? null;
              
              // If not found, try wildcard
              if (!matchedCard) {
                 matchedCard = (await dbQuery(
                   `SELECT id FROM cards WHERE slug ILIKE $1 LIMIT 1`,
                   [`${guessSlug}%`],
                 ) as Array<{ id: string }>)[0] ?? null;
              }

              await dbQuery(
                `INSERT INTO deck_cards (deck_id, card_id, raw_card_id_string, raw_card_name, count)
                 VALUES ($1, $2, $3, $4, $5)`,
                [insertedDeck.id, matchedCard?.id ?? null, c.rawId, c.name, c.count],
              );

              if (!leaderCardId && matchedCard) {
                  leaderCardId = matchedCard.id;
              }
            }

            await dbQuery(
              `UPDATE decks SET leader_card_id = $1 WHERE id = $2`,
              [leaderCardId, insertedDeck.id],
            );
          }
        }
      });
    }

    return { message: 'Sync complete' };
  }
);
