import { inngest } from '../client';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

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
      const { data } = await supabase.from('games').select('id').eq('slug', 'one-piece').single();
      return data?.id;
    });

    if (!gameId) return { message: 'One Piece game not found' };

    // 3. Process each tournament sequentially to be polite
    for (const t of tournaments.slice(0, 5)) {
      const tournamentId = await step.run(`sync-tournament-${t.url}`, async () => {
        const { data: existing } = await supabase.from('tournaments').select('id').eq('source_url', t.url).maybeSingle();
        if (existing) return existing.id; // Already processed

        const { data: inserted, error } = await supabase.from('tournaments').insert({
          name: t.name,
          date: t.date,
          format: t.format,
          num_players: t.players,
          source_url: t.url,
          game_id: gameId
        }).select('id').single();

        if (error || !inserted) return null;
        return inserted.id;
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
          const { data: existingDeck } = await supabase.from('decks').select('id').eq('source_url', d.deckUrl).maybeSingle();
          if (existingDeck) continue;

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

          const { data: insertedDeck, error: deckErr } = await supabase.from('decks').insert({
            tournament_id: tournamentId,
            player_name: d.player,
            placement: d.placement,
            source_url: d.deckUrl
          }).select('id').single();

          if (insertedDeck) {
            let leaderCardId = null;

            for (const c of cards) {
              const guessSlug = `op-${c.rawId.toLowerCase()}`;
              // Try exactly
              let { data: matchedCard } = await supabase.from('cards').select('id').eq('slug', guessSlug).maybeSingle();
              
              // If not found, try wildcard
              if (!matchedCard) {
                 const { data: fuzzyCard } = await supabase.from('cards').select('id').ilike('slug', guessSlug + '%').limit(1).maybeSingle();
                 matchedCard = fuzzyCard;
              }

              await supabase.from('deck_cards').insert({
                deck_id: insertedDeck.id,
                card_id: matchedCard?.id || null,
                raw_card_id_string: c.rawId,
                raw_card_name: c.name,
                count: c.count
              });

              if (!leaderCardId && matchedCard) {
                  leaderCardId = matchedCard.id;
              }
            }

            await supabase.from('decks').update({ 
                leader_card_id: leaderCardId
            }).eq('id', insertedDeck.id);
          }
        }
      });
    }

    return { message: 'Sync complete' };
  }
);
