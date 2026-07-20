import 'dotenv/config';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log("Starting manual scrape...");

  const res = await fetch('https://onepiece.limitlesstcg.com/tournaments');
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const tournaments: any[] = [];
  $('table.completed-tournaments tbody tr').each((i, el) => {
    const name = $(el).find('td:nth-child(3) a').text().trim();
    let url = $(el).find('td:nth-child(3) a').attr('href');
    const dateStr = $(el).find('td:nth-child(1)').text().trim();
    const playersStr = $(el).find('td:nth-child(6)').text().trim();
    
    if (name && url) {
      if (url.startsWith('/')) url = `https://onepiece.limitlesstcg.com${url}`;
      
      tournaments.push({
        name,
        url,
        date: new Date(dateStr).toISOString(),
        format: 'Standard',
        players: parseInt(playersStr.replace(/[^0-9]/g, ''), 10) || 0
      });
    }
  });

  const { data } = await supabase.from('games').select('id').eq('slug', 'one-piece').single();
  const gameId = data?.id;

  for (const t of tournaments.slice(0, 3)) {
    console.log(`Processing tournament: ${t.name} at ${t.url}`);

    const { data: existing } = await supabase.from('tournaments').select('id').eq('source_url', t.url).maybeSingle();
    let tournamentId = existing?.id;

    if (!tournamentId) {
        const { data: inserted, error } = await supabase.from('tournaments').insert({
        name: t.name,
        date: t.date,
        format: t.format,
        num_players: t.players,
        source_url: t.url,
        game_id: gameId
        }).select('id').single();

        if (error || !inserted) {
            console.error('Failed to insert tournament:', error);
            continue;
        }
        tournamentId = inserted.id;
    }
    
    console.log(`Tournament ID: ${tournamentId}`);
    await delay(1000); 

    const res2 = await fetch(t.url);
    const html2 = await res2.text();
    const $2 = cheerio.load(html2);

    const deckUrls: any[] = [];
    $2('.tournament-results tbody tr').slice(0, 4).each((i, el) => {
      const placement = $2(el).find('td:nth-child(1)').text().trim();
      const player = $2(el).find('td:nth-child(2) a').text().trim();
      let deckUrl = $2(el).find('td:nth-child(4) a').attr('href');
      
      if (deckUrl) {
        if (deckUrl.startsWith('/')) deckUrl = `https://onepiece.limitlesstcg.com${deckUrl}`;
        deckUrls.push({ placement, player, deckUrl });
      }
    });

    console.log(`Found ${deckUrls.length} decks.`);

    for (const d of deckUrls) {
      console.log(`Processing deck by ${d.player}`);
      
      const { data: existingDeck } = await supabase.from('decks').select('id').eq('source_url', d.deckUrl).maybeSingle();
      if (existingDeck) {
          console.log(`Deck already exists: ${existingDeck.id}`);
          continue;
      }

      await delay(1000);
      const dRes = await fetch(d.deckUrl);
      const dHtml = await dRes.text();
      const $d = cheerio.load(dHtml);

      const cards: any[] = [];
      $d('.decklist-card').each((i, el) => {
        const countStr = $d(el).attr('data-count');
        const rawId = $d(el).attr('data-id');
        let name = $d(el).find('.card-name').text().trim();
        name = name.replace(/\s*\([a-zA-Z0-9-]+\)\s*$/, ''); // Remove (OP01-001)
        
        if (countStr && rawId) {
          cards.push({ count: parseInt(countStr, 10) || 1, rawId, name });
        }
      });

      console.log(`Found ${cards.length} unique cards.`);

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
          let { data: matchedCard } = await supabase.from('cards').select('id').eq('slug', guessSlug).maybeSingle();
              
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

          if (!leaderCardId && matchedCard) leaderCardId = matchedCard.id;
        }

        if (leaderCardId) {
          await supabase.from('decks').update({ 
              leader_card_id: leaderCardId
          }).eq('id', insertedDeck.id);
        }
      }
    }
  }
  console.log('Manual scrape complete.');
}
run();
