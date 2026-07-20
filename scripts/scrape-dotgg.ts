import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const targetGame = process.argv[2];
  if (!targetGame || !['onepiece', 'dragonball'].includes(targetGame)) {
    console.error('Please specify a valid game: onepiece OR dragonball');
    console.error('Usage: npx tsx scripts/scrape-dotgg.ts [game]');
    return;
  }

  const gameSlugMap: Record<string, string> = {
    'onepiece': 'one-piece',
    'dragonball': 'dbfw'
  };

  const internalGameSlug = gameSlugMap[targetGame];
  console.log(`Starting DotGG API Scraper for ${targetGame} (Internal: ${internalGameSlug})...`);

  try {
    const { data: gameData } = await supabase.from('games').select('id').eq('slug', internalGameSlug).single();
    const gameId = gameData?.id;

    if (!gameId) {
      console.error(`Could not find game ID for slug: ${internalGameSlug}`);
      return;
    }

    // 1. Fetch Tournaments Page 1
    const tRes = await fetch(`https://api.dotgg.gg/cgfw/gettournaments?game=${targetGame}&page=1`);
    const tournaments = await tRes.json();
    console.log(`Found ${tournaments.length} tournaments.`);

    if (tournaments.length === 0) return;

    // Process top 10 tournaments
    for (const t of tournaments.slice(0, 10)) {
      console.log(`\nProcessing Tournament: ${t.name}`);
      const sourceUrl = `https://${targetGame}.gg/tournaments/${t.slug}`;

      // Insert Tournament
      let { data: dbTournament } = await supabase
        .from('tournaments')
        .select('id')
        .eq('source_url', sourceUrl)
        .maybeSingle();

      if (!dbTournament) {
        const { data: insertedT, error: tError } = await supabase
          .from('tournaments')
          .insert({
            name: t.name,
            date: new Date(parseInt(t.date) * 1000).toISOString(),
            format: 'Standard',
            num_players: parseInt(t.players_count) || 0,
            source_url: sourceUrl,
            game_id: gameId
          })
          .select()
          .single();
        
        if (tError) {
          console.error('Error inserting tournament:', tError);
          continue;
        }
        dbTournament = insertedT;
      }

      console.log(`Tournament ID: ${dbTournament.id}`);

      // 2. Fetch Tournament Standings
      const stdRes = await fetch(`https://api.dotgg.gg/cgfw/gettournament?game=${targetGame}&slug=${t.slug}`);
      const stdData = await stdRes.json();
      const standings = stdData.standings || [];
      
      console.log(`Found ${standings.length} standings.`);

      // Process ALL standings
      for (const standing of standings) {
        console.log(`\n  Processing Player: ${standing.player_name} (Rank ${standing.standing_place})`);
        const deckSourceUrl = `https://${targetGame}.gg/decks/${standing.slug}`;

        // Insert Deck
        let { data: dbDeck } = await supabase
          .from('decks')
          .select('id')
          .eq('source_url', deckSourceUrl)
          .maybeSingle();

        if (!dbDeck) {
          const { data: insertedD, error: dError } = await supabase
            .from('decks')
            .insert({
              tournament_id: dbTournament.id,
              player_name: standing.player_name || 'Unknown',
              placement: parseInt(standing.standing_place) || 0,
              source_url: deckSourceUrl
            })
            .select()
            .single();

          if (dError) {
            console.error('  Error inserting deck:', dError);
            continue;
          }
          dbDeck = insertedD;
        }

        console.log(`  Deck ID: ${dbDeck.id}`);

        // 3. Fetch Decklist
        if (!standing.slug) {
          console.log('  No deck slug available, skipping.');
          continue;
        }

        // Check if we already have cards for this deck
        const { count } = await supabase.from('deck_cards').select('*', { count: 'exact', head: true }).eq('deck_id', dbDeck.id);
        if (count && count > 0) {
          console.log('  Deck cards already exist, skipping extraction.');
          continue;
        }

        const dRes = await fetch(`https://api.dotgg.gg/cgfw/getdeck?game=${targetGame}&slug=${standing.slug}`);
        const deckData = await dRes.json();
        
        const cards = deckData.deck || {};
        let leaderCardId = null;

        for (const [rawCardId, countStr] of Object.entries(cards)) {
          const cleanCardId = rawCardId.split('_')[0];
          const cardCount = parseInt(countStr as string) || 1;

          // Search by number column (e.g. OP01-001 or FB01-002)
          const { data: matchedCards } = await supabase
            .from('cards')
            .select('id, rarity')
            .ilike('number', `${cleanCardId}%`)
            .limit(1);

          const cardId = matchedCards && matchedCards.length > 0 ? matchedCards[0].id : null;
          
          if (cardId && matchedCards && matchedCards.length > 0) {
            const r = matchedCards[0].rarity;
            if (r === 'Leader' || r === 'L') {
              leaderCardId = cardId;
            }
          }

          if (cardId) {
            await supabase
              .from('deck_cards')
              .insert({
                deck_id: dbDeck.id,
                card_id: cardId,
                raw_card_name: cleanCardId,
                raw_card_id_string: rawCardId,
                count: cardCount
              });
          } else {
             // Fallback for unmapped cards
             await supabase
              .from('deck_cards')
              .insert({
                deck_id: dbDeck.id,
                raw_card_name: cleanCardId,
                raw_card_id_string: rawCardId,
                count: cardCount
              });
          }
        }

        // Update deck with leader card id if found
        if (leaderCardId) {
          await supabase
            .from('decks')
            .update({ leader_card_id: leaderCardId })
            .eq('id', dbDeck.id);
          console.log(`  Set leader card to: ${leaderCardId}`);
        }
        
        console.log(`  Finished processing deck for ${standing.player_name}`);
      }
    }

    console.log('\nSuccess! Check database for results.');
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

main();
