import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

export const POKEMON_JA_SET_NAMES: Record<string, string> = {
  // Mega Series (2025-2026)
  'M6': 'M6 : Storm Emeralda',
  'M5': 'M5 : Abyss Eye',
  'M4': 'M4 : Ninja Spinner',
  'M3': 'M3 : Muniquis Zero',
  'MC': 'MC : Start Deck 100 Battle Collection',
  'M2a': 'M2a : MEGA Dream ex',
  'M2': 'M2 : Inferno X',
  'M1S': 'M1S : Mega Symphonia',
  'M1L': 'M1L : Mega Brave',
  'M-P': 'M-P : Mega Promo Cards',

  // Scarlet & Violet Series (SV)
  'SV11B': 'SV11B : Black Bolt',
  'SV11W': 'SV11W : White Flare',
  'SV10': 'SV10 : Glory of Team Rocket',
  'SV9a': 'SV9a : Heat Wave Arena',
  'SV9': 'SV9 : Battle Partners',
  'SV8a': 'SV8a : Terastal Festival ex',
  'SV8': 'SV8 : Supercharged Breaker',
  'SV7a': 'SV7a : Paradise Dragona',
  'SV7': 'SV7 : Stellar Miracle',
  'SVK': 'SVK : Deck Build Box: Stellar Miracle',
  'SVLS': 'SVLS : Starter Set Tera: Ceruledge ex',
  'SVLN': 'SVLN : Starter Set Tera: Sylveon ex',
  'SV6a': 'SV6a : Night Wanderer',
  'SV6': 'SV6 : Mask of Change',
  'SV5a': 'SV5a : Crimson Haze',
  'SV5K': 'SV5K : Wild Force',
  'SV5M': 'SV5M : Cyber Judge',
  'SV4a': 'SV4a : Shiny Treasure ex',
  'SV4M': 'SV4M : Future Flash',
  'SV4K': 'SV4K : Ancient Roar',
  'SV3a': 'SV3a : Raging Surf',
  'SV3': 'SV3 : Ruler of the Black Flame',
  'SV2a': 'SV2a : Pokémon Card 151',
  'SV2P': 'SV2P : Snow Hazard',
  'SV2D': 'SV2D : Clay Burst',
  'SV1a': 'SV1a : Triplet Beat',
  'SV1V': 'SV1V : Violet ex',
  'SV1S': 'SV1S : Scarlet ex',
  'SV-P': 'SV-P : Scarlet & Violet Promo Cards',

  // Simplified Chinese / Asia Special Sets
  'CS1a': 'CS1a : Triplet Beat Vol.1',
  'CS1b': 'CS1b : Triplet Beat Vol.2',
  'CS1.5': 'CS1.5 : Triplet Beat Special',
  'CS2a': 'CS2a : Triplet Beat Vol.3',
  'CS2b': 'CS2b : Triplet Beat Vol.4',
  'CS2.5': 'CS2.5 : Triplet Beat Premium',
  'CS3a': 'CS3a : Triplet Beat Vol.5',
  'CS3b': 'CS3b : Triplet Beat Vol.6',
  'CS3.5': 'CS3.5 : Triplet Beat Ultra',
  'CS3D': 'CS3D : Triplet Beat Decks',
  'CS4': 'CS4 : Triplet Beat Mega',
  'CS4a': 'CS4a : Triplet Beat Evolution',
  'CS4b': 'CS4b : Triplet Beat Apex',
  'CS4Da': 'CS4Da : Triplet Beat Challenge',
  'CSA': 'CSA : Triplet Beat Anniversary',

  // Sword & Shield Series (S)
  'S12a': 'S12a : VSTAR Universe',
  'S12': 'S12 : Paradigm Trigger',
  'S11a': 'S11a : Incandescent Arcana',
  'S11': 'S11 : Lost Abyss',
  'S10b': 'S10b : Pokémon GO',
  'S10a': 'S10a : Dark Phantasma',
  'S10D': 'S10D : Time Gazer',
  'S10P': 'S10P : Space Juggler',
  'S9a': 'S9a : Battle Region',
  'S9': 'S9 : Star Birth',
  'S8b': 'S8b : VMAX Climax',
  'S8a': 'S8a : 25th Anniversary Collection',
  'S8': 'S8 : Fusion Arts',
  'S7R': 'S7R : Blue Sky Stream',
  'S7D': 'S7D : Towering Perfection',
  'S6a': 'S6a : Eevee Heroes',
  'S6K': 'S6K : Jet-Black Spirit',
  'S6H': 'S6H : Silver Lance',
  'S5a': 'S5a : Matchless Fighters',
  'S5R': 'S5R : Rapid Strike Master',
  'S5I': 'S5I : Single Strike Master',
  'S4a': 'S4a : Shiny Star V',
  'S4': 'S4 : Amazing Volt Tackle',
  'S3a': 'S3a : Legendary Heartbeat',
  'S3': 'S3 : Infinity Zone',
  'S2a': 'S2a : Explosive Flame Walker',
  'S2': 'S2 : Rebellion Crash',
  'S1a': 'S1a : VMAX Rising',
  'S1H': 'S1H : Shield',
  'S1W': 'S1W : Sword',

  // Sun & Moon Series (SM)
  'SM12a': 'SM12a : Tag Team GX: Tag All Stars',
  'SM12': 'SM12 : Alter Genesis',
  'SM11b': 'SM11b : Dream League',
  'SM11a': 'SM11a : Remix Bout',
  'SM11': 'SM11 : Miracle Twin',
  'SMP2': 'SMP2 : Detective Pikachu',
  'SM10b': 'SM10b : Sky Legend',
  'SM10a': 'SM10a : GG End',
  'SM10': 'SM10 : Double Blaze',
  'SM9b': 'SM9b : Full Metal Wall',
  'SM9a': 'SM9a : Night Unison',
  'SM9': 'SM9 : Tag Bolt',
  'SM8b': 'SM8b : GX Ultra Shiny',
  'SM8a': 'SM8a : Dark Order',
  'SM8': 'SM8 : Explosive Impact',
  'SM7b': 'SM7b : Fairy Rise',
  'SM7a': 'SM7a : Thunderclap Spark',
  'SM7': 'SM7 : Sky-Splitting Charisma',
  'SM6b': 'SM6b : Champion Road',
  'SM6a': 'SM6a : Dragon Storm',
  'SM6': 'SM6 : Forbidden Light',
  'SM5+': 'SM5+ : Ultra Force',
  'SM5p': 'SM5p : Ultra Force Enhanced',
  'SM5M': 'SM5M : Ultra Moon',
  'SM5S': 'SM5S : Ultra Sun',
  'SM4+': 'SM4+ : GX Battle Boost',
  'SM4p': 'SM4p : GX Battle Boost Enhanced',
  'SM4S': 'SM4S : Awakened Heroes',
  'SM4A': 'SM4A : Ultradimensional Beasts',
  'SM3+': 'SM3+ : Shining Legends',
  'SM3p': 'SM3p : Shining Legends Enhanced',
  'SM3H': 'SM3H : Did You See the Fighting Rainbow?',
  'SM3N': 'SM3N : Darkness that Consumes Light',
  'sm2+': 'SM2+ : Beyond a New Challenge',
  'SM2p': 'SM2p : Beyond a New Challenge Enhanced',
  'SM2K': 'SM2K : Islands Awaiting You',
  'SM2L': 'SM2L : Alolan Moonlight',
  'SM1+': 'SM1+ : Sun & Moon Enhanced Expansion',
  'SM1p': 'SM1p : Sun & Moon Plus',
  'SM1M': 'SM1M : Collection Moon',
  'SM1S': 'SM1S : Collection Sun',
  'SM0': 'SM0 : Pikachu and New Friends',

  // XY Series
  'CP6': 'CP6 : 20th Anniversary Expansion Pack',
  'CP5': 'CP5 : Mythical & Legendary Dream Shine',
  'XY11b': 'XY11b : Cruel Traitor',
  'XY11a': 'XY11a : Fever-Burst Fighter',
  'CP4': 'CP4 : Premium Champion Pack EX×M×BREAK',
  'XY10': 'XY10 : Awakening of the Psychic King',
  'CP3': 'CP3 : PokéKyun Collection',
  'XY9': 'XY9 : Rage of the Broken Heavens',
  'XY8b': 'XY8b : Red Flash',
  'XY8a': 'XY8a : Blue Shock',
  'CP2': 'CP2 : Legendary Shine Collection',
  'XY7': 'XY7 : Bandit Ring',
  'XY6': 'XY6 : Emerald Break',
  'CP1': 'CP1 : Double Crisis: Magma vs Aqua',
  'XY5b': 'XY5b : Tidal Storm',
  'XY5a': 'XY5a : Gaia Volcano',
  'XY4': 'XY4 : Phantom Gate',
  'XY3': 'XY3 : Rising Fist',
  'XY2': 'XY2 : Wild Blaze',
  'XY1b': 'XY1b : Collection Y',
  'XY1a': 'XY1a : Collection X',

  // LEGEND / HGSS Era (L)
  'L3': 'L3 : Clash at the Summit',
  'LL': 'LL : Lost Link',
  'L2': 'L2 : Reviving Legends',
  'L1b': 'L1b : SoulSilver Collection',
  'L1a': 'L1a : HeartGold Collection',

  // PCG (EX Era)
  'PCG10': 'PCG10 : World Champions Pack',
  'PCG9': 'PCG9 : Offense and Defense of the Furthest Ends',
  'PCG8': 'PCG8 : Miracle Crystal',
  'PCG7': 'PCG7 : Holon Phantom',
  'PCG6': 'PCG6 : Holon Research Tower',
  'PCG5': 'PCG5 : Eidolon Forest',
  'PCG4': 'PCG4 : Golden Sky, Silvery Ocean',
  'PCG3': 'PCG3 : Rocket Gang Strikes Back',
  'PCG2': 'PCG2 : Clash of the Blue Sky',
  'PCG1': 'PCG1 : Flight of Legends',

  // ADV Era
  'ADV5': 'ADV5 : Rulers of the Heavens',
  'ADV4': 'ADV4 : Magma vs Aqua: Two Ambitions',
  'ADV3': 'ADV3 : Rulers of the Heavens',
  'ADV2': 'ADV2 : Miracle of the Desert',
  'ADV1': 'ADV1 : Expansion Pack (ADV)',

  // e-Series (E)
  'E5': 'E5 : Mysterious Mountains',
  'E4': 'E4 : Split Earth',
  'E3': 'E3 : Wind from the Sea',
  'E2': 'E2 : Town on No Map',
  'E1': 'E1 : Base Expansion Pack (e-Series)',

  // Special Vintage
  'web1': 'WEB : Pokémon Card ★ Web',
  'VS1': 'VS : Pokémon Card ★ VS',

  // Neo Era
  'neo4': 'neo4 : Darkness, and to Light...',
  'neo3': 'neo3 : Awakening Legends',
  'neo2': 'neo2 : Crossing the Ruins...',
  'neo1': 'neo1 : Gold, Silver, to a New World',

  // Pocket Monsters Card Game (Original Generation 1)
  'PMCG6': 'PMCG6 : Challenge from the Darkness',
  'PMCG5': 'PMCG5 : Leaders\' Stadium',
  'PMCG4': 'PMCG4 : Team Rocket',
  'PMCG3': 'PMCG3 : Mystery of the Fossils',
  'PMCG2': 'PMCG2 : Pokémon Jungle',
  'PMCG1': 'PMCG1 : Base Expansion Pack',
};

async function translatePokemonJaSets() {
  console.log('[Pokemon JA Translate] Fetching Japanese sets from database...');

  const sets = await dbQuery<{ id: string; ppt_set_id: string; name: string; slug: string }>(
    `SELECT id, ppt_set_id, name, slug FROM sets WHERE slug LIKE 'pokemon-%-ja'`,
  );

  console.log(`[Pokemon JA Translate] Found ${sets.length} Japanese sets to check.`);

  let updatedCount = 0;
  for (const set of sets) {
    const code = set.ppt_set_id || '';
    let englishName = POKEMON_JA_SET_NAMES[code];

    if (!englishName) {
      // Fallback: Code + Clean Title
      englishName = `${code} : ${set.name}`;
    }

    if (set.name !== englishName) {
      await dbQuery(
        `UPDATE sets SET name = $1 WHERE id = $2`,
        [englishName, set.id],
      );
      console.log(`Updated [${code}]: "${set.name}" -> "${englishName}"`);
      updatedCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`[Pokemon JA Translate] Updated ${updatedCount} / ${sets.length} sets to English!`);
  console.log(`========================================\n`);

  // Invalidate Redis caches
  const cacheKeys = [
    'api:sets:pokemon',
    'api:sets:pokemon:ja',
    'api:sets:pokemon:en',
    'api:games:all',
  ];
  for (const key of cacheKeys) {
    await redis.del(key);
  }
  console.log('[Pokemon JA Translate] Flushed Redis set caches.');
}

translatePokemonJaSets()
  .catch((err) => {
    console.error('[Pokemon JA Translate] Fatal Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
