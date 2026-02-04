// Centralized mock data for TCGMaster
// Contains 10+ sets across games with 100+ cards

export interface MockCard {
  id: string;
  name: string;
  slug: string;
  number: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'holo-rare' | 'ultra-rare';
  type?: string; // For Pokemon: fire, water, grass, etc.
  image_url: string | null;
  prices: {
    raw: number | null;
    psa7: number | null;
    psa8: number | null;
    psa9: number | null;
    psa10: number | null;
  };
  change24h: number;
}

export interface MockSet {
  id: string;
  name: string;
  slug: string;
  game: string;
  gameSlug: string;
  release_date: string;
  card_count: number;
  description: string;
  avg_price: number;
  trending: boolean;
  cards: MockCard[];
  related_sets: string[]; // slugs
}

// Rarity color map for placeholder backgrounds
export const rarityColors: Record<string, string> = {
  common: 'bg-zinc-200',
  uncommon: 'bg-blue-200',
  rare: 'bg-blue-400',
  'holo-rare': 'bg-gradient-to-br from-yellow-300 to-amber-400',
  'ultra-rare': 'bg-gradient-to-br from-purple-400 to-pink-400',
};

// Pokemon energy type colors for placeholder gradients
export const pokemonTypeColors: Record<string, string> = {
  fire: 'bg-gradient-to-br from-red-400 to-orange-500',
  water: 'bg-gradient-to-br from-blue-400 to-cyan-500',
  grass: 'bg-gradient-to-br from-green-400 to-emerald-500',
  electric: 'bg-gradient-to-br from-yellow-300 to-amber-400',
  psychic: 'bg-gradient-to-br from-purple-400 to-pink-400',
  fighting: 'bg-gradient-to-br from-orange-500 to-red-600',
  normal: 'bg-gradient-to-br from-zinc-300 to-zinc-400',
  colorless: 'bg-gradient-to-br from-zinc-200 to-zinc-300',
  darkness: 'bg-gradient-to-br from-zinc-700 to-zinc-900',
  metal: 'bg-gradient-to-br from-slate-400 to-slate-500',
  dragon: 'bg-gradient-to-br from-indigo-500 to-violet-600',
  fairy: 'bg-gradient-to-br from-pink-300 to-pink-400',
};

// Helper to generate realistic price ladders
function generatePrices(baseRaw: number | null, rarity: string): MockCard['prices'] {
  if (baseRaw === null) {
    return { raw: null, psa7: null, psa8: null, psa9: null, psa10: null };
  }

  // Price multipliers vary by rarity
  const multipliers = {
    common: { psa7: 2, psa8: 3, psa9: 6, psa10: 15 },
    uncommon: { psa7: 2.5, psa8: 4, psa9: 8, psa10: 20 },
    rare: { psa7: 3, psa8: 5, psa9: 12, psa10: 35 },
    'holo-rare': { psa7: 4, psa8: 8, psa9: 20, psa10: 80 },
    'ultra-rare': { psa7: 5, psa8: 12, psa9: 35, psa10: 100 },
  };

  const m = multipliers[rarity as keyof typeof multipliers] || multipliers.common;

  return {
    raw: baseRaw,
    psa7: Math.round(baseRaw * m.psa7),
    psa8: Math.round(baseRaw * m.psa8),
    psa9: Math.round(baseRaw * m.psa9),
    psa10: Math.round(baseRaw * m.psa10),
  };
}

// Helper to generate random price change
function randomChange(): number {
  return Math.round((Math.random() * 20 - 5) * 10) / 10; // -5% to +15%
}

// ============================================
// POKEMON SETS
// ============================================

const baseSetCards: MockCard[] = [
  { id: 'bs-1', name: 'Alakazam', slug: 'alakazam', number: '1/102', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(85, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-2', name: 'Blastoise', slug: 'blastoise', number: '2/102', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(180, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-3', name: 'Chansey', slug: 'chansey', number: '3/102', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(55, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-4', name: 'Charizard', slug: 'charizard', number: '4/102', rarity: 'holo-rare', type: 'fire', image_url: null, prices: generatePrices(450, 'holo-rare'), change24h: 5.2 },
  { id: 'bs-5', name: 'Clefairy', slug: 'clefairy', number: '5/102', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(42, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-6', name: 'Gyarados', slug: 'gyarados', number: '6/102', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(75, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-7', name: 'Hitmonchan', slug: 'hitmonchan', number: '7/102', rarity: 'holo-rare', type: 'fighting', image_url: null, prices: generatePrices(48, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-8', name: 'Machamp', slug: 'machamp', number: '8/102', rarity: 'holo-rare', type: 'fighting', image_url: null, prices: generatePrices(35, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-9', name: 'Magneton', slug: 'magneton', number: '9/102', rarity: 'holo-rare', type: 'electric', image_url: null, prices: generatePrices(38, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-10', name: 'Mewtwo', slug: 'mewtwo', number: '10/102', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(95, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-11', name: 'Nidoking', slug: 'nidoking', number: '11/102', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(52, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-12', name: 'Ninetales', slug: 'ninetales', number: '12/102', rarity: 'holo-rare', type: 'fire', image_url: null, prices: generatePrices(58, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-13', name: 'Poliwrath', slug: 'poliwrath', number: '13/102', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(45, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-14', name: 'Raichu', slug: 'raichu', number: '14/102', rarity: 'holo-rare', type: 'electric', image_url: null, prices: generatePrices(62, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-15', name: 'Venusaur', slug: 'venusaur', number: '15/102', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(160, 'holo-rare'), change24h: randomChange() },
  { id: 'bs-16', name: 'Zapdos', slug: 'zapdos', number: '16/102', rarity: 'holo-rare', type: 'electric', image_url: null, prices: generatePrices(65, 'holo-rare'), change24h: randomChange() },
  // Rare non-holos
  { id: 'bs-17', name: 'Beedrill', slug: 'beedrill', number: '17/102', rarity: 'rare', type: 'grass', image_url: null, prices: generatePrices(12, 'rare'), change24h: randomChange() },
  { id: 'bs-18', name: 'Dragonair', slug: 'dragonair', number: '18/102', rarity: 'rare', type: 'colorless', image_url: null, prices: generatePrices(25, 'rare'), change24h: randomChange() },
  { id: 'bs-19', name: 'Dugtrio', slug: 'dugtrio', number: '19/102', rarity: 'rare', type: 'fighting', image_url: null, prices: generatePrices(8, 'rare'), change24h: randomChange() },
  { id: 'bs-20', name: 'Electabuzz', slug: 'electabuzz', number: '20/102', rarity: 'rare', type: 'electric', image_url: null, prices: generatePrices(10, 'rare'), change24h: randomChange() },
  { id: 'bs-21', name: 'Electrode', slug: 'electrode', number: '21/102', rarity: 'rare', type: 'electric', image_url: null, prices: generatePrices(7, 'rare'), change24h: randomChange() },
  { id: 'bs-22', name: 'Pidgeotto', slug: 'pidgeotto', number: '22/102', rarity: 'rare', type: 'colorless', image_url: null, prices: generatePrices(6, 'rare'), change24h: randomChange() },
  // Uncommons
  { id: 'bs-23', name: 'Arcanine', slug: 'arcanine', number: '23/102', rarity: 'uncommon', type: 'fire', image_url: null, prices: generatePrices(15, 'uncommon'), change24h: randomChange() },
  { id: 'bs-24', name: 'Charmeleon', slug: 'charmeleon', number: '24/102', rarity: 'uncommon', type: 'fire', image_url: null, prices: generatePrices(22, 'uncommon'), change24h: randomChange() },
  { id: 'bs-25', name: 'Dewgong', slug: 'dewgong', number: '25/102', rarity: 'uncommon', type: 'water', image_url: null, prices: generatePrices(4, 'uncommon'), change24h: randomChange() },
  { id: 'bs-26', name: 'Dratini', slug: 'dratini', number: '26/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(8, 'uncommon'), change24h: randomChange() },
  { id: 'bs-27', name: 'Farfetch\'d', slug: 'farfetchd', number: '27/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(5, 'uncommon'), change24h: randomChange() },
  { id: 'bs-28', name: 'Growlithe', slug: 'growlithe', number: '28/102', rarity: 'uncommon', type: 'fire', image_url: null, prices: generatePrices(6, 'uncommon'), change24h: randomChange() },
  { id: 'bs-29', name: 'Haunter', slug: 'haunter', number: '29/102', rarity: 'uncommon', type: 'psychic', image_url: null, prices: generatePrices(7, 'uncommon'), change24h: randomChange() },
  { id: 'bs-30', name: 'Ivysaur', slug: 'ivysaur', number: '30/102', rarity: 'uncommon', type: 'grass', image_url: null, prices: generatePrices(18, 'uncommon'), change24h: randomChange() },
  // Commons
  { id: 'bs-31', name: 'Jynx', slug: 'jynx', number: '31/102', rarity: 'uncommon', type: 'psychic', image_url: null, prices: generatePrices(3, 'uncommon'), change24h: randomChange() },
  { id: 'bs-32', name: 'Kadabra', slug: 'kadabra', number: '32/102', rarity: 'uncommon', type: 'psychic', image_url: null, prices: generatePrices(5, 'uncommon'), change24h: randomChange() },
  { id: 'bs-33', name: 'Kakuna', slug: 'kakuna', number: '33/102', rarity: 'uncommon', type: 'grass', image_url: null, prices: generatePrices(3, 'uncommon'), change24h: randomChange() },
  { id: 'bs-34', name: 'Machoke', slug: 'machoke', number: '34/102', rarity: 'uncommon', type: 'fighting', image_url: null, prices: generatePrices(4, 'uncommon'), change24h: randomChange() },
  { id: 'bs-35', name: 'Magikarp', slug: 'magikarp', number: '35/102', rarity: 'uncommon', type: 'water', image_url: null, prices: generatePrices(6, 'uncommon'), change24h: randomChange() },
  { id: 'bs-36', name: 'Magmar', slug: 'magmar', number: '36/102', rarity: 'uncommon', type: 'fire', image_url: null, prices: generatePrices(4, 'uncommon'), change24h: randomChange() },
  { id: 'bs-37', name: 'Nidorino', slug: 'nidorino', number: '37/102', rarity: 'uncommon', type: 'grass', image_url: null, prices: generatePrices(4, 'uncommon'), change24h: randomChange() },
  { id: 'bs-38', name: 'Poliwhirl', slug: 'poliwhirl', number: '38/102', rarity: 'uncommon', type: 'water', image_url: null, prices: generatePrices(4, 'uncommon'), change24h: randomChange() },
  { id: 'bs-39', name: 'Porygon', slug: 'porygon', number: '39/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(5, 'uncommon'), change24h: randomChange() },
  { id: 'bs-40', name: 'Raticate', slug: 'raticate', number: '40/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(3, 'uncommon'), change24h: randomChange() },
  { id: 'bs-41', name: 'Seel', slug: 'seel', number: '41/102', rarity: 'uncommon', type: 'water', image_url: null, prices: generatePrices(2, 'uncommon'), change24h: randomChange() },
  { id: 'bs-42', name: 'Wartortle', slug: 'wartortle', number: '42/102', rarity: 'uncommon', type: 'water', image_url: null, prices: generatePrices(20, 'uncommon'), change24h: randomChange() },
  // Commons
  { id: 'bs-43', name: 'Abra', slug: 'abra', number: '43/102', rarity: 'common', type: 'psychic', image_url: null, prices: generatePrices(3, 'common'), change24h: randomChange() },
  { id: 'bs-44', name: 'Bulbasaur', slug: 'bulbasaur', number: '44/102', rarity: 'common', type: 'grass', image_url: null, prices: generatePrices(12, 'common'), change24h: randomChange() },
  { id: 'bs-45', name: 'Caterpie', slug: 'caterpie', number: '45/102', rarity: 'common', type: 'grass', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-46', name: 'Charmander', slug: 'charmander', number: '46/102', rarity: 'common', type: 'fire', image_url: null, prices: generatePrices(18, 'common'), change24h: randomChange() },
  { id: 'bs-47', name: 'Diglett', slug: 'diglett', number: '47/102', rarity: 'common', type: 'fighting', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-48', name: 'Doduo', slug: 'doduo', number: '48/102', rarity: 'common', type: 'colorless', image_url: null, prices: generatePrices(1, 'common'), change24h: randomChange() },
  { id: 'bs-49', name: 'Drowzee', slug: 'drowzee', number: '49/102', rarity: 'common', type: 'psychic', image_url: null, prices: generatePrices(1, 'common'), change24h: randomChange() },
  { id: 'bs-50', name: 'Gastly', slug: 'gastly', number: '50/102', rarity: 'common', type: 'psychic', image_url: null, prices: generatePrices(3, 'common'), change24h: randomChange() },
  { id: 'bs-51', name: 'Koffing', slug: 'koffing', number: '51/102', rarity: 'common', type: 'grass', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-52', name: 'Machop', slug: 'machop', number: '52/102', rarity: 'common', type: 'fighting', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-53', name: 'Magnemite', slug: 'magnemite', number: '53/102', rarity: 'common', type: 'electric', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-54', name: 'Metapod', slug: 'metapod', number: '54/102', rarity: 'common', type: 'grass', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-55', name: 'Nidoran M', slug: 'nidoran-m', number: '55/102', rarity: 'common', type: 'grass', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-56', name: 'Onix', slug: 'onix', number: '56/102', rarity: 'common', type: 'fighting', image_url: null, prices: generatePrices(3, 'common'), change24h: randomChange() },
  { id: 'bs-57', name: 'Pidgey', slug: 'pidgey', number: '57/102', rarity: 'common', type: 'colorless', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-58', name: 'Pikachu', slug: 'pikachu', number: '58/102', rarity: 'common', type: 'electric', image_url: null, prices: generatePrices(15, 'common'), change24h: randomChange() },
  { id: 'bs-59', name: 'Poliwag', slug: 'poliwag', number: '59/102', rarity: 'common', type: 'water', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-60', name: 'Ponyta', slug: 'ponyta', number: '60/102', rarity: 'common', type: 'fire', image_url: null, prices: generatePrices(3, 'common'), change24h: randomChange() },
  { id: 'bs-61', name: 'Rattata', slug: 'rattata', number: '61/102', rarity: 'common', type: 'colorless', image_url: null, prices: generatePrices(1, 'common'), change24h: randomChange() },
  { id: 'bs-62', name: 'Sandshrew', slug: 'sandshrew', number: '62/102', rarity: 'common', type: 'fighting', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-63', name: 'Squirtle', slug: 'squirtle', number: '63/102', rarity: 'common', type: 'water', image_url: null, prices: generatePrices(14, 'common'), change24h: randomChange() },
  { id: 'bs-64', name: 'Starmie', slug: 'starmie', number: '64/102', rarity: 'common', type: 'water', image_url: null, prices: generatePrices(3, 'common'), change24h: randomChange() },
  { id: 'bs-65', name: 'Staryu', slug: 'staryu', number: '65/102', rarity: 'common', type: 'water', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-66', name: 'Tangela', slug: 'tangela', number: '66/102', rarity: 'common', type: 'grass', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-67', name: 'Voltorb', slug: 'voltorb', number: '67/102', rarity: 'common', type: 'electric', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-68', name: 'Vulpix', slug: 'vulpix', number: '68/102', rarity: 'common', type: 'fire', image_url: null, prices: generatePrices(4, 'common'), change24h: randomChange() },
  { id: 'bs-69', name: 'Weedle', slug: 'weedle', number: '69/102', rarity: 'common', type: 'grass', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  // Trainers
  { id: 'bs-70', name: 'Clefairy Doll', slug: 'clefairy-doll', number: '70/102', rarity: 'rare', type: 'colorless', image_url: null, prices: generatePrices(5, 'rare'), change24h: randomChange() },
  { id: 'bs-71', name: 'Computer Search', slug: 'computer-search', number: '71/102', rarity: 'rare', type: 'colorless', image_url: null, prices: generatePrices(12, 'rare'), change24h: randomChange() },
  { id: 'bs-72', name: 'Devolution Spray', slug: 'devolution-spray', number: '72/102', rarity: 'rare', type: 'colorless', image_url: null, prices: generatePrices(6, 'rare'), change24h: randomChange() },
  { id: 'bs-73', name: 'Impostor Professor Oak', slug: 'impostor-professor-oak', number: '73/102', rarity: 'rare', type: 'colorless', image_url: null, prices: generatePrices(5, 'rare'), change24h: randomChange() },
  { id: 'bs-74', name: 'Item Finder', slug: 'item-finder', number: '74/102', rarity: 'rare', type: 'colorless', image_url: null, prices: generatePrices(10, 'rare'), change24h: randomChange() },
  { id: 'bs-75', name: 'Lass', slug: 'lass', number: '75/102', rarity: 'rare', type: 'colorless', image_url: null, prices: generatePrices(5, 'rare'), change24h: randomChange() },
  { id: 'bs-76', name: 'Pokemon Breeder', slug: 'pokemon-breeder', number: '76/102', rarity: 'rare', type: 'colorless', image_url: null, prices: generatePrices(8, 'rare'), change24h: randomChange() },
  { id: 'bs-77', name: 'Pokemon Trader', slug: 'pokemon-trader', number: '77/102', rarity: 'rare', type: 'colorless', image_url: null, prices: generatePrices(6, 'rare'), change24h: randomChange() },
  { id: 'bs-78', name: 'Scoop Up', slug: 'scoop-up', number: '78/102', rarity: 'rare', type: 'colorless', image_url: null, prices: generatePrices(5, 'rare'), change24h: randomChange() },
  { id: 'bs-79', name: 'Super Energy Removal', slug: 'super-energy-removal', number: '79/102', rarity: 'rare', type: 'colorless', image_url: null, prices: generatePrices(8, 'rare'), change24h: randomChange() },
  { id: 'bs-80', name: 'Defender', slug: 'defender', number: '80/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(2, 'uncommon'), change24h: randomChange() },
  { id: 'bs-81', name: 'Energy Retrieval', slug: 'energy-retrieval', number: '81/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(2, 'uncommon'), change24h: randomChange() },
  { id: 'bs-82', name: 'Full Heal', slug: 'full-heal', number: '82/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(2, 'uncommon'), change24h: randomChange() },
  { id: 'bs-83', name: 'Maintenance', slug: 'maintenance', number: '83/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(2, 'uncommon'), change24h: randomChange() },
  { id: 'bs-84', name: 'PlusPower', slug: 'pluspower', number: '84/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(3, 'uncommon'), change24h: randomChange() },
  { id: 'bs-85', name: 'Pokemon Center', slug: 'pokemon-center', number: '85/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(3, 'uncommon'), change24h: randomChange() },
  { id: 'bs-86', name: 'Pokemon Flute', slug: 'pokemon-flute', number: '86/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(2, 'uncommon'), change24h: randomChange() },
  { id: 'bs-87', name: 'Pokedex', slug: 'pokedex', number: '87/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(2, 'uncommon'), change24h: randomChange() },
  { id: 'bs-88', name: 'Professor Oak', slug: 'professor-oak', number: '88/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(5, 'uncommon'), change24h: randomChange() },
  { id: 'bs-89', name: 'Revive', slug: 'revive', number: '89/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(2, 'uncommon'), change24h: randomChange() },
  { id: 'bs-90', name: 'Super Potion', slug: 'super-potion', number: '90/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(2, 'uncommon'), change24h: randomChange() },
  { id: 'bs-91', name: 'Bill', slug: 'bill', number: '91/102', rarity: 'common', type: 'colorless', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-92', name: 'Energy Removal', slug: 'energy-removal', number: '92/102', rarity: 'common', type: 'colorless', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-93', name: 'Gust of Wind', slug: 'gust-of-wind', number: '93/102', rarity: 'common', type: 'colorless', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  { id: 'bs-94', name: 'Potion', slug: 'potion', number: '94/102', rarity: 'common', type: 'colorless', image_url: null, prices: generatePrices(1, 'common'), change24h: randomChange() },
  { id: 'bs-95', name: 'Switch', slug: 'switch', number: '95/102', rarity: 'common', type: 'colorless', image_url: null, prices: generatePrices(2, 'common'), change24h: randomChange() },
  // Energy
  { id: 'bs-96', name: 'Double Colorless Energy', slug: 'double-colorless-energy', number: '96/102', rarity: 'uncommon', type: 'colorless', image_url: null, prices: generatePrices(6, 'uncommon'), change24h: randomChange() },
  { id: 'bs-97', name: 'Fighting Energy', slug: 'fighting-energy', number: '97/102', rarity: 'common', type: 'fighting', image_url: null, prices: generatePrices(1, 'common'), change24h: randomChange() },
  { id: 'bs-98', name: 'Fire Energy', slug: 'fire-energy', number: '98/102', rarity: 'common', type: 'fire', image_url: null, prices: generatePrices(1, 'common'), change24h: randomChange() },
  { id: 'bs-99', name: 'Grass Energy', slug: 'grass-energy', number: '99/102', rarity: 'common', type: 'grass', image_url: null, prices: generatePrices(1, 'common'), change24h: randomChange() },
  { id: 'bs-100', name: 'Lightning Energy', slug: 'lightning-energy', number: '100/102', rarity: 'common', type: 'electric', image_url: null, prices: generatePrices(1, 'common'), change24h: randomChange() },
  { id: 'bs-101', name: 'Psychic Energy', slug: 'psychic-energy', number: '101/102', rarity: 'common', type: 'psychic', image_url: null, prices: generatePrices(1, 'common'), change24h: randomChange() },
  { id: 'bs-102', name: 'Water Energy', slug: 'water-energy', number: '102/102', rarity: 'common', type: 'water', image_url: null, prices: generatePrices(1, 'common'), change24h: randomChange() },
];

const jungleCards: MockCard[] = [
  { id: 'ju-1', name: 'Clefable', slug: 'clefable', number: '1/64', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(35, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-2', name: 'Electrode', slug: 'electrode', number: '2/64', rarity: 'holo-rare', type: 'electric', image_url: null, prices: generatePrices(28, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-3', name: 'Flareon', slug: 'flareon', number: '3/64', rarity: 'holo-rare', type: 'fire', image_url: null, prices: generatePrices(85, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-4', name: 'Jolteon', slug: 'jolteon', number: '4/64', rarity: 'holo-rare', type: 'electric', image_url: null, prices: generatePrices(75, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-5', name: 'Kangaskhan', slug: 'kangaskhan', number: '5/64', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(32, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-6', name: 'Mr. Mime', slug: 'mr-mime', number: '6/64', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(30, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-7', name: 'Nidoqueen', slug: 'nidoqueen', number: '7/64', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(38, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-8', name: 'Pidgeot', slug: 'pidgeot', number: '8/64', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(42, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-9', name: 'Pinsir', slug: 'pinsir', number: '9/64', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(28, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-10', name: 'Scyther', slug: 'scyther', number: '10/64', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(55, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-11', name: 'Snorlax', slug: 'snorlax', number: '11/64', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(65, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-12', name: 'Vaporeon', slug: 'vaporeon', number: '12/64', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(80, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-13', name: 'Venomoth', slug: 'venomoth', number: '13/64', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(28, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-14', name: 'Victreebel', slug: 'victreebel', number: '14/64', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(32, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-15', name: 'Vileplume', slug: 'vileplume', number: '15/64', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(35, 'holo-rare'), change24h: randomChange() },
  { id: 'ju-16', name: 'Wigglytuff', slug: 'wigglytuff', number: '16/64', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(38, 'holo-rare'), change24h: randomChange() },
];

const fossilCards: MockCard[] = [
  { id: 'fo-1', name: 'Aerodactyl', slug: 'aerodactyl', number: '1/62', rarity: 'holo-rare', type: 'fighting', image_url: null, prices: generatePrices(42, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-2', name: 'Articuno', slug: 'articuno', number: '2/62', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(75, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-3', name: 'Ditto', slug: 'ditto', number: '3/62', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(35, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-4', name: 'Dragonite', slug: 'dragonite', number: '4/62', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(95, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-5', name: 'Gengar', slug: 'gengar', number: '5/62', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(85, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-6', name: 'Haunter', slug: 'haunter', number: '6/62', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(45, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-7', name: 'Hitmonlee', slug: 'hitmonlee', number: '7/62', rarity: 'holo-rare', type: 'fighting', image_url: null, prices: generatePrices(32, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-8', name: 'Hypno', slug: 'hypno', number: '8/62', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(28, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-9', name: 'Kabutops', slug: 'kabutops', number: '9/62', rarity: 'holo-rare', type: 'fighting', image_url: null, prices: generatePrices(38, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-10', name: 'Lapras', slug: 'lapras', number: '10/62', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(48, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-11', name: 'Magneton', slug: 'magneton', number: '11/62', rarity: 'holo-rare', type: 'electric', image_url: null, prices: generatePrices(32, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-12', name: 'Moltres', slug: 'moltres', number: '12/62', rarity: 'holo-rare', type: 'fire', image_url: null, prices: generatePrices(68, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-13', name: 'Muk', slug: 'muk', number: '13/62', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(25, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-14', name: 'Raichu', slug: 'raichu', number: '14/62', rarity: 'holo-rare', type: 'electric', image_url: null, prices: generatePrices(42, 'holo-rare'), change24h: randomChange() },
  { id: 'fo-15', name: 'Zapdos', slug: 'zapdos', number: '15/62', rarity: 'holo-rare', type: 'electric', image_url: null, prices: generatePrices(58, 'holo-rare'), change24h: randomChange() },
];

const teamRocketCards: MockCard[] = [
  { id: 'tr-1', name: 'Dark Alakazam', slug: 'dark-alakazam', number: '1/82', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(38, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-2', name: 'Dark Arbok', slug: 'dark-arbok', number: '2/82', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(28, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-3', name: 'Dark Blastoise', slug: 'dark-blastoise', number: '3/82', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(85, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-4', name: 'Dark Charizard', slug: 'dark-charizard', number: '4/82', rarity: 'holo-rare', type: 'fire', image_url: null, prices: generatePrices(220, 'holo-rare'), change24h: 8.5 },
  { id: 'tr-5', name: 'Dark Dragonite', slug: 'dark-dragonite', number: '5/82', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(75, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-6', name: 'Dark Dugtrio', slug: 'dark-dugtrio', number: '6/82', rarity: 'holo-rare', type: 'fighting', image_url: null, prices: generatePrices(22, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-7', name: 'Dark Golbat', slug: 'dark-golbat', number: '7/82', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(18, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-8', name: 'Dark Gyarados', slug: 'dark-gyarados', number: '8/82', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(35, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-9', name: 'Dark Hypno', slug: 'dark-hypno', number: '9/82', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(25, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-10', name: 'Dark Machamp', slug: 'dark-machamp', number: '10/82', rarity: 'holo-rare', type: 'fighting', image_url: null, prices: generatePrices(32, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-11', name: 'Dark Magneton', slug: 'dark-magneton', number: '11/82', rarity: 'holo-rare', type: 'electric', image_url: null, prices: generatePrices(28, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-12', name: 'Dark Slowbro', slug: 'dark-slowbro', number: '12/82', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(22, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-13', name: 'Dark Vileplume', slug: 'dark-vileplume', number: '13/82', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(28, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-14', name: 'Dark Weezing', slug: 'dark-weezing', number: '14/82', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(22, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-15', name: 'Here Comes Team Rocket!', slug: 'here-comes-team-rocket', number: '15/82', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(18, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-16', name: 'Rockets Sneak Attack', slug: 'rockets-sneak-attack', number: '16/82', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(15, 'holo-rare'), change24h: randomChange() },
  { id: 'tr-17', name: 'Rainbow Energy', slug: 'rainbow-energy', number: '17/82', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(22, 'holo-rare'), change24h: randomChange() },
];

const neoGenesisCards: MockCard[] = [
  { id: 'ng-1', name: 'Ampharos', slug: 'ampharos', number: '1/111', rarity: 'holo-rare', type: 'electric', image_url: null, prices: generatePrices(42, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-2', name: 'Azumarill', slug: 'azumarill', number: '2/111', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(28, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-3', name: 'Bellossom', slug: 'bellossom', number: '3/111', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(32, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-4', name: 'Feraligatr', slug: 'feraligatr', number: '4/111', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(55, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-5', name: 'Feraligatr', slug: 'feraligatr-2', number: '5/111', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(48, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-6', name: 'Heracross', slug: 'heracross', number: '6/111', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(35, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-7', name: 'Jumpluff', slug: 'jumpluff', number: '7/111', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(25, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-8', name: 'Kingdra', slug: 'kingdra', number: '8/111', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(38, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-9', name: 'Lugia', slug: 'lugia', number: '9/111', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(185, 'holo-rare'), change24h: 6.8 },
  { id: 'ng-10', name: 'Meganium', slug: 'meganium', number: '10/111', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(48, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-11', name: 'Meganium', slug: 'meganium-2', number: '11/111', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(42, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-12', name: 'Pichu', slug: 'pichu', number: '12/111', rarity: 'holo-rare', type: 'electric', image_url: null, prices: generatePrices(45, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-13', name: 'Skarmory', slug: 'skarmory', number: '13/111', rarity: 'holo-rare', type: 'metal', image_url: null, prices: generatePrices(32, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-14', name: 'Slowking', slug: 'slowking', number: '14/111', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(28, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-15', name: 'Steelix', slug: 'steelix', number: '15/111', rarity: 'holo-rare', type: 'metal', image_url: null, prices: generatePrices(42, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-16', name: 'Togetic', slug: 'togetic', number: '16/111', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(35, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-17', name: 'Typhlosion', slug: 'typhlosion', number: '17/111', rarity: 'holo-rare', type: 'fire', image_url: null, prices: generatePrices(125, 'holo-rare'), change24h: randomChange() },
  { id: 'ng-18', name: 'Typhlosion', slug: 'typhlosion-2', number: '18/111', rarity: 'holo-rare', type: 'fire', image_url: null, prices: generatePrices(95, 'holo-rare'), change24h: randomChange() },
];

const neoDiscoveryCards: MockCard[] = [
  { id: 'nd-1', name: 'Espeon', slug: 'espeon', number: '1/75', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(145, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-2', name: 'Forretress', slug: 'forretress', number: '2/75', rarity: 'holo-rare', type: 'metal', image_url: null, prices: generatePrices(25, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-3', name: 'Hitmontop', slug: 'hitmontop', number: '3/75', rarity: 'holo-rare', type: 'fighting', image_url: null, prices: generatePrices(28, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-4', name: 'Houndoom', slug: 'houndoom', number: '4/75', rarity: 'holo-rare', type: 'darkness', image_url: null, prices: generatePrices(55, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-5', name: 'Houndour', slug: 'houndour', number: '5/75', rarity: 'holo-rare', type: 'darkness', image_url: null, prices: generatePrices(22, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-6', name: 'Kabutops', slug: 'kabutops', number: '6/75', rarity: 'holo-rare', type: 'fighting', image_url: null, prices: generatePrices(32, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-7', name: 'Magnemite', slug: 'magnemite', number: '7/75', rarity: 'holo-rare', type: 'metal', image_url: null, prices: generatePrices(18, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-8', name: 'Politoed', slug: 'politoed', number: '8/75', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(38, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-9', name: 'Poliwrath', slug: 'poliwrath', number: '9/75', rarity: 'holo-rare', type: 'water', image_url: null, prices: generatePrices(28, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-10', name: 'Scizor', slug: 'scizor', number: '10/75', rarity: 'holo-rare', type: 'metal', image_url: null, prices: generatePrices(75, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-11', name: 'Smeargle', slug: 'smeargle', number: '11/75', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(32, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-12', name: 'Tyranitar', slug: 'tyranitar', number: '12/75', rarity: 'holo-rare', type: 'darkness', image_url: null, prices: generatePrices(125, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-13', name: 'Umbreon', slug: 'umbreon', number: '13/75', rarity: 'holo-rare', type: 'darkness', image_url: null, prices: generatePrices(185, 'holo-rare'), change24h: 4.2 },
  { id: 'nd-14', name: 'Unown A', slug: 'unown-a', number: '14/75', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(18, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-15', name: 'Ursaring', slug: 'ursaring', number: '15/75', rarity: 'holo-rare', type: 'colorless', image_url: null, prices: generatePrices(28, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-16', name: 'Wobbuffet', slug: 'wobbuffet', number: '16/75', rarity: 'holo-rare', type: 'psychic', image_url: null, prices: generatePrices(22, 'holo-rare'), change24h: randomChange() },
  { id: 'nd-17', name: 'Yanma', slug: 'yanma', number: '17/75', rarity: 'holo-rare', type: 'grass', image_url: null, prices: generatePrices(18, 'holo-rare'), change24h: randomChange() },
];

// ============================================
// BASKETBALL SETS
// ============================================

const fleer1986Cards: MockCard[] = [
  { id: 'fl86-1', name: 'Kareem Abdul-Jabbar', slug: 'kareem-abdul-jabbar', number: '1/132', rarity: 'uncommon', type: undefined, image_url: null, prices: generatePrices(85, 'rare'), change24h: randomChange() },
  { id: 'fl86-7', name: 'Charles Barkley RC', slug: 'charles-barkley-rc', number: '7/132', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(450, 'holo-rare'), change24h: 3.2 },
  { id: 'fl86-9', name: 'Larry Bird', slug: 'larry-bird', number: '9/132', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(320, 'holo-rare'), change24h: randomChange() },
  { id: 'fl86-26', name: 'Clyde Drexler RC', slug: 'clyde-drexler-rc', number: '26/132', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(125, 'holo-rare'), change24h: randomChange() },
  { id: 'fl86-31', name: 'Patrick Ewing RC', slug: 'patrick-ewing-rc', number: '31/132', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(185, 'holo-rare'), change24h: randomChange() },
  { id: 'fl86-53', name: 'Magic Johnson', slug: 'magic-johnson', number: '53/132', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(285, 'holo-rare'), change24h: randomChange() },
  { id: 'fl86-57', name: 'Michael Jordan RC', slug: 'michael-jordan-rc', number: '57/132', rarity: 'ultra-rare', type: undefined, image_url: null, prices: generatePrices(28500, 'ultra-rare'), change24h: 2.8 },
  { id: 'fl86-68', name: 'Karl Malone RC', slug: 'karl-malone-rc', number: '68/132', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(145, 'holo-rare'), change24h: randomChange() },
  { id: 'fl86-77', name: 'Hakeem Olajuwon RC', slug: 'hakeem-olajuwon-rc', number: '77/132', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(385, 'holo-rare'), change24h: randomChange() },
  { id: 'fl86-82', name: 'Robert Parish', slug: 'robert-parish', number: '82/132', rarity: 'uncommon', type: undefined, image_url: null, prices: generatePrices(25, 'uncommon'), change24h: randomChange() },
  { id: 'fl86-109', name: 'Isiah Thomas RC', slug: 'isiah-thomas-rc', number: '109/132', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(165, 'holo-rare'), change24h: randomChange() },
  { id: 'fl86-119', name: 'Dominique Wilkins RC', slug: 'dominique-wilkins-rc', number: '119/132', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(145, 'holo-rare'), change24h: randomChange() },
  { id: 'fl86-121', name: 'James Worthy RC', slug: 'james-worthy-rc', number: '121/132', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(95, 'holo-rare'), change24h: randomChange() },
];

const toppsChrome2003Cards: MockCard[] = [
  { id: 'tc03-1', name: 'Shaquille O\'Neal', slug: 'shaquille-oneal', number: '1/165', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(45, 'rare'), change24h: randomChange() },
  { id: 'tc03-23', name: 'Kobe Bryant', slug: 'kobe-bryant', number: '23/165', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(185, 'holo-rare'), change24h: randomChange() },
  { id: 'tc03-111', name: 'LeBron James RC', slug: 'lebron-james-rc', number: '111/165', rarity: 'ultra-rare', type: undefined, image_url: null, prices: generatePrices(8500, 'ultra-rare'), change24h: 4.5 },
  { id: 'tc03-113', name: 'Carmelo Anthony RC', slug: 'carmelo-anthony-rc', number: '113/165', rarity: 'holo-rare', type: undefined, image_url: null, prices: generatePrices(125, 'holo-rare'), change24h: randomChange() },
  { id: 'tc03-114', name: 'Chris Bosh RC', slug: 'chris-bosh-rc', number: '114/165', rarity: 'holo-rare', type: undefined, image_url: null, prices: generatePrices(85, 'holo-rare'), change24h: randomChange() },
  { id: 'tc03-115', name: 'Dwyane Wade RC', slug: 'dwyane-wade-rc', number: '115/165', rarity: 'holo-rare', type: undefined, image_url: null, prices: generatePrices(285, 'holo-rare'), change24h: randomChange() },
  { id: 'tc03-121', name: 'Kirk Hinrich RC', slug: 'kirk-hinrich-rc', number: '121/165', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(15, 'rare'), change24h: randomChange() },
  { id: 'tc03-125', name: 'David West RC', slug: 'david-west-rc', number: '125/165', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(12, 'rare'), change24h: randomChange() },
  { id: 'tc03-130', name: 'Boris Diaw RC', slug: 'boris-diaw-rc', number: '130/165', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(8, 'rare'), change24h: randomChange() },
  { id: 'tc03-140', name: 'Kyle Korver RC', slug: 'kyle-korver-rc', number: '140/165', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(18, 'rare'), change24h: randomChange() },
];

// ============================================
// BASEBALL SETS
// ============================================

const topps1952Cards: MockCard[] = [
  { id: 't52-1', name: 'Andy Pafko', slug: 'andy-pafko', number: '1/407', rarity: 'uncommon', type: undefined, image_url: null, prices: generatePrices(1250, 'rare'), change24h: randomChange() },
  { id: 't52-2', name: 'Pete Runnels', slug: 'pete-runnels', number: '2/407', rarity: 'common', type: undefined, image_url: null, prices: generatePrices(45, 'common'), change24h: randomChange() },
  { id: 't52-33', name: 'Warren Spahn', slug: 'warren-spahn', number: '33/407', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(850, 'holo-rare'), change24h: randomChange() },
  { id: 't52-37', name: 'Duke Snider', slug: 'duke-snider', number: '37/407', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(685, 'holo-rare'), change24h: randomChange() },
  { id: 't52-48', name: 'Joe Page', slug: 'joe-page', number: '48/407', rarity: 'uncommon', type: undefined, image_url: null, prices: generatePrices(85, 'uncommon'), change24h: randomChange() },
  { id: 't52-59', name: 'Robin Roberts', slug: 'robin-roberts', number: '59/407', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(385, 'holo-rare'), change24h: randomChange() },
  { id: 't52-175', name: 'Billy Martin RC', slug: 'billy-martin-rc', number: '175/407', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(525, 'holo-rare'), change24h: randomChange() },
  { id: 't52-191', name: 'Yogi Berra', slug: 'yogi-berra', number: '191/407', rarity: 'holo-rare', type: undefined, image_url: null, prices: generatePrices(2850, 'holo-rare'), change24h: randomChange() },
  { id: 't52-261', name: 'Willie Mays', slug: 'willie-mays', number: '261/407', rarity: 'ultra-rare', type: undefined, image_url: null, prices: generatePrices(42500, 'ultra-rare'), change24h: 1.8 },
  { id: 't52-311', name: 'Mickey Mantle', slug: 'mickey-mantle', number: '311/407', rarity: 'ultra-rare', type: undefined, image_url: null, prices: generatePrices(185000, 'ultra-rare'), change24h: 0.5 },
  { id: 't52-312', name: 'Jackie Robinson', slug: 'jackie-robinson', number: '312/407', rarity: 'ultra-rare', type: undefined, image_url: null, prices: generatePrices(28500, 'ultra-rare'), change24h: randomChange() },
  { id: 't52-314', name: 'Roy Campanella', slug: 'roy-campanella', number: '314/407', rarity: 'holo-rare', type: undefined, image_url: null, prices: generatePrices(4850, 'holo-rare'), change24h: randomChange() },
  { id: 't52-333', name: 'Pee Wee Reese', slug: 'pee-wee-reese', number: '333/407', rarity: 'holo-rare', type: undefined, image_url: null, prices: generatePrices(2250, 'holo-rare'), change24h: randomChange() },
  { id: 't52-400', name: 'Bill Dickey', slug: 'bill-dickey', number: '400/407', rarity: 'holo-rare', type: undefined, image_url: null, prices: generatePrices(3250, 'holo-rare'), change24h: randomChange() },
  { id: 't52-407', name: 'Eddie Mathews RC', slug: 'eddie-mathews-rc', number: '407/407', rarity: 'ultra-rare', type: undefined, image_url: null, prices: generatePrices(12500, 'ultra-rare'), change24h: randomChange() },
];

const upperDeck1989Cards: MockCard[] = [
  { id: 'ud89-1', name: 'Ken Griffey Jr. RC', slug: 'ken-griffey-jr-rc', number: '1/800', rarity: 'ultra-rare', type: undefined, image_url: null, prices: generatePrices(125, 'ultra-rare'), change24h: 5.2 },
  { id: 'ud89-13', name: 'Gary Sheffield RC', slug: 'gary-sheffield-rc', number: '13/800', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(18, 'rare'), change24h: randomChange() },
  { id: 'ud89-17', name: 'John Smoltz RC', slug: 'john-smoltz-rc', number: '17/800', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(22, 'rare'), change24h: randomChange() },
  { id: 'ud89-25', name: 'Randy Johnson RC', slug: 'randy-johnson-rc', number: '25/800', rarity: 'holo-rare', type: undefined, image_url: null, prices: generatePrices(45, 'holo-rare'), change24h: randomChange() },
  { id: 'ud89-195', name: 'Nolan Ryan', slug: 'nolan-ryan', number: '195/800', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(25, 'rare'), change24h: randomChange() },
  { id: 'ud89-200', name: 'Don Mattingly', slug: 'don-mattingly', number: '200/800', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(12, 'rare'), change24h: randomChange() },
  { id: 'ud89-241', name: 'Craig Biggio RC', slug: 'craig-biggio-rc', number: '241/800', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(28, 'rare'), change24h: randomChange() },
  { id: 'ud89-273', name: 'Deion Sanders RC', slug: 'deion-sanders-rc', number: '273/800', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(15, 'rare'), change24h: randomChange() },
  { id: 'ud89-357', name: 'Tom Glavine', slug: 'tom-glavine', number: '357/800', rarity: 'uncommon', type: undefined, image_url: null, prices: generatePrices(8, 'uncommon'), change24h: randomChange() },
  { id: 'ud89-440', name: 'Barry Bonds', slug: 'barry-bonds', number: '440/800', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(18, 'rare'), change24h: randomChange() },
  { id: 'ud89-467', name: 'Cal Ripken Jr.', slug: 'cal-ripken-jr', number: '467/800', rarity: 'rare', type: undefined, image_url: null, prices: generatePrices(15, 'rare'), change24h: randomChange() },
  { id: 'ud89-774', name: 'Dale Murphy', slug: 'dale-murphy', number: '774/800', rarity: 'uncommon', type: undefined, image_url: null, prices: generatePrices(5, 'uncommon'), change24h: randomChange() },
];

// ============================================
// EXPORT ALL SETS
// ============================================

export const mockSets: Record<string, MockSet> = {
  // Pokemon Sets (1999)
  'base-set': {
    id: 'pokemon-base-set',
    name: 'Base Set',
    slug: 'base-set',
    game: 'Pokemon',
    gameSlug: 'pokemon',
    release_date: '1999-01-09',
    card_count: 102,
    description: 'The original Pokemon TCG set that started it all. Released in Japan in 1996 and in the US in 1999, Base Set remains one of the most iconic and valuable sets in Pokemon TCG history.',
    avg_price: 45,
    trending: true,
    cards: baseSetCards,
    related_sets: ['jungle', 'fossil', 'base-set-2'],
  },
  'jungle': {
    id: 'pokemon-jungle',
    name: 'Jungle',
    slug: 'jungle',
    game: 'Pokemon',
    gameSlug: 'pokemon',
    release_date: '1999-06-16',
    card_count: 64,
    description: 'The second expansion to the Pokemon TCG, featuring Pokemon from the Safari Zone and Jungle areas.',
    avg_price: 32,
    trending: false,
    cards: jungleCards,
    related_sets: ['base-set', 'fossil', 'base-set-2'],
  },
  'fossil': {
    id: 'pokemon-fossil',
    name: 'Fossil',
    slug: 'fossil',
    game: 'Pokemon',
    gameSlug: 'pokemon',
    release_date: '1999-10-10',
    card_count: 62,
    description: 'The third expansion to the Pokemon TCG, introducing Fossil Pokemon and the legendary birds.',
    avg_price: 38,
    trending: false,
    cards: fossilCards,
    related_sets: ['base-set', 'jungle', 'base-set-2'],
  },
  'team-rocket': {
    id: 'pokemon-team-rocket',
    name: 'Team Rocket',
    slug: 'team-rocket',
    game: 'Pokemon',
    gameSlug: 'pokemon',
    release_date: '2000-04-24',
    card_count: 82,
    description: 'The fifth expansion to the Pokemon TCG, featuring Dark Pokemon owned by Team Rocket.',
    avg_price: 42,
    trending: true,
    cards: teamRocketCards,
    related_sets: ['base-set-2', 'gym-heroes', 'gym-challenge'],
  },
  // Pokemon Sets (2000)
  'neo-genesis': {
    id: 'pokemon-neo-genesis',
    name: 'Neo Genesis',
    slug: 'neo-genesis',
    game: 'Pokemon',
    gameSlug: 'pokemon',
    release_date: '2000-12-16',
    card_count: 111,
    description: 'The first set of the Neo series, introducing Generation II Pokemon including Lugia and the Johto starters.',
    avg_price: 55,
    trending: true,
    cards: neoGenesisCards,
    related_sets: ['neo-discovery', 'neo-revelation', 'neo-destiny'],
  },
  'neo-discovery': {
    id: 'pokemon-neo-discovery',
    name: 'Neo Discovery',
    slug: 'neo-discovery',
    game: 'Pokemon',
    gameSlug: 'pokemon',
    release_date: '2001-06-01',
    card_count: 75,
    description: 'The second set of the Neo series, featuring Espeon, Umbreon, and other evolved forms of Johto Pokemon.',
    avg_price: 48,
    trending: false,
    cards: neoDiscoveryCards,
    related_sets: ['neo-genesis', 'neo-revelation', 'neo-destiny'],
  },
  // Basketball Sets
  '1986-fleer': {
    id: 'basketball-1986-fleer',
    name: '1986-87 Fleer',
    slug: '1986-fleer',
    game: 'Basketball',
    gameSlug: 'basketball',
    release_date: '1986-11-01',
    card_count: 132,
    description: 'The most iconic basketball card set ever produced. Features the legendary Michael Jordan rookie card and rookies of many Hall of Famers.',
    avg_price: 2500,
    trending: true,
    cards: fleer1986Cards,
    related_sets: ['1987-fleer', '1988-fleer'],
  },
  '2003-topps-chrome': {
    id: 'basketball-2003-topps-chrome',
    name: '2003-04 Topps Chrome',
    slug: '2003-topps-chrome',
    game: 'Basketball',
    gameSlug: 'basketball',
    release_date: '2003-12-01',
    card_count: 165,
    description: 'One of the most sought-after modern basketball sets. Features the LeBron James rookie card along with Wade, Anthony, and Bosh rookies.',
    avg_price: 850,
    trending: true,
    cards: toppsChrome2003Cards,
    related_sets: ['2003-topps', '2003-upper-deck'],
  },
  // Baseball Sets
  '1952-topps': {
    id: 'baseball-1952-topps',
    name: '1952 Topps',
    slug: '1952-topps',
    game: 'Baseball',
    gameSlug: 'baseball',
    release_date: '1952-03-01',
    card_count: 407,
    description: 'Considered the most important baseball card set ever produced. Features the iconic Mickey Mantle #311 card, one of the most valuable sports cards in existence.',
    avg_price: 8500,
    trending: true,
    cards: topps1952Cards,
    related_sets: ['1953-topps', '1951-bowman'],
  },
  '1989-upper-deck': {
    id: 'baseball-1989-upper-deck',
    name: '1989 Upper Deck',
    slug: '1989-upper-deck',
    game: 'Baseball',
    gameSlug: 'baseball',
    release_date: '1989-03-01',
    card_count: 800,
    description: 'Revolutionary set that changed the hobby with premium card stock and anti-counterfeiting holograms. Features the iconic Ken Griffey Jr. rookie card at #1.',
    avg_price: 35,
    trending: false,
    cards: upperDeck1989Cards,
    related_sets: ['1989-topps', '1989-donruss', '1989-fleer'],
  },
};

// Helper to get a set by game slug and set slug
export function getSetBySlug(gameSlug: string, setSlug: string): MockSet | undefined {
  const set = mockSets[setSlug];
  if (set && set.gameSlug === gameSlug) {
    return set;
  }
  return undefined;
}

// Helper to get all sets for a game
export function getSetsByGame(gameSlug: string): MockSet[] {
  return Object.values(mockSets).filter(set => set.gameSlug === gameSlug);
}

// Helper to get related sets
export function getRelatedSets(setSlug: string): MockSet[] {
  const set = mockSets[setSlug];
  if (!set) return [];
  return set.related_sets
    .map(slug => mockSets[slug])
    .filter((s): s is MockSet => s !== undefined);
}

// Helper to get top gainers (mock market data)
export function getTopGainers(period: '24h' | '7d' | '30d', limit: number = 50): (MockCard & { setName: string; game: string })[] {
  const allCards: (MockCard & { setName: string; game: string })[] = [];

  Object.values(mockSets).forEach(set => {
    set.cards.forEach(card => {
      allCards.push({
        ...card,
        setName: set.name,
        game: set.game,
      });
    });
  });

  // Simulate different periods by adjusting change values
  const periodMultiplier = period === '24h' ? 1 : period === '7d' ? 2.5 : 5;

  return allCards
    .map(card => ({
      ...card,
      change24h: card.change24h * periodMultiplier,
    }))
    .filter(card => card.change24h > 0)
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, limit);
}

// Helper to get top losers (mock market data)
export function getTopLosers(period: '24h' | '7d' | '30d', limit: number = 50): (MockCard & { setName: string; game: string })[] {
  const allCards: (MockCard & { setName: string; game: string })[] = [];

  Object.values(mockSets).forEach(set => {
    set.cards.forEach(card => {
      allCards.push({
        ...card,
        setName: set.name,
        game: set.game,
      });
    });
  });

  // Simulate different periods by adjusting change values
  const periodMultiplier = period === '24h' ? 1 : period === '7d' ? 2.5 : 5;

  return allCards
    .map(card => ({
      ...card,
      change24h: card.change24h * periodMultiplier,
    }))
    .filter(card => card.change24h < 0)
    .sort((a, b) => a.change24h - b.change24h)
    .slice(0, limit);
}
