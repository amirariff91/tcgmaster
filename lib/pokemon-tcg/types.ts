/**
 * Pokemon TCG API Types
 * Based on https://docs.pokemontcg.io/
 */

export interface PokemonTCGImages {
  small: string; // 245px width
  large: string; // 734px width
}

export interface PokemonTCGAttack {
  name: string;
  cost: string[];
  convertedEnergyCost: number;
  damage: string;
  text: string;
}

export interface PokemonTCGWeakness {
  type: string;
  value: string;
}

export interface PokemonTCGResistance {
  type: string;
  value: string;
}

export interface PokemonTCGAbility {
  name: string;
  text: string;
  type: string;
}

export interface PokemonTCGLegality {
  unlimited?: string;
  standard?: string;
  expanded?: string;
}

export interface PokemonTCGSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  legalities: PokemonTCGLegality;
  ptcgoCode?: string;
  releaseDate: string;
  updatedAt: string;
  images: {
    symbol: string;
    logo: string;
  };
}

export interface PokemonTCGCardMarket {
  url: string;
  updatedAt: string;
  prices?: {
    averageSellPrice?: number;
    lowPrice?: number;
    trendPrice?: number;
    germanProLow?: number;
    suggestedPrice?: number;
    reverseHoloSell?: number;
    reverseHoloLow?: number;
    reverseHoloTrend?: number;
    lowPriceExPlus?: number;
    avg1?: number;
    avg7?: number;
    avg30?: number;
    reverseHoloAvg1?: number;
    reverseHoloAvg7?: number;
    reverseHoloAvg30?: number;
  };
}

export interface PokemonTCGTcgplayer {
  url: string;
  updatedAt: string;
  prices?: {
    holofoil?: {
      low?: number;
      mid?: number;
      high?: number;
      market?: number;
      directLow?: number;
    };
    reverseHolofoil?: {
      low?: number;
      mid?: number;
      high?: number;
      market?: number;
      directLow?: number;
    };
    normal?: {
      low?: number;
      mid?: number;
      high?: number;
      market?: number;
      directLow?: number;
    };
    '1stEditionHolofoil'?: {
      low?: number;
      mid?: number;
      high?: number;
      market?: number;
      directLow?: number;
    };
  };
}

export interface PokemonTCGCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  rules?: string[];
  abilities?: PokemonTCGAbility[];
  attacks?: PokemonTCGAttack[];
  weaknesses?: PokemonTCGWeakness[];
  resistances?: PokemonTCGResistance[];
  retreatCost?: string[];
  convertedRetreatCost?: number;
  set: PokemonTCGSet;
  number: string;
  artist?: string;
  rarity?: string;
  flavorText?: string;
  nationalPokedexNumbers?: number[];
  legalities: PokemonTCGLegality;
  images: PokemonTCGImages;
  tcgplayer?: PokemonTCGTcgplayer;
  cardmarket?: PokemonTCGCardMarket;
}

export interface PokemonTCGResponse<T> {
  data: T;
  page?: number;
  pageSize?: number;
  count?: number;
  totalCount?: number;
}

export interface PokemonTCGSearchParams {
  q?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  select?: string;
}

// Set mapping for common set names to Pokemon TCG API set IDs
export const SET_ID_MAP: Record<string, string> = {
  'base-set': 'base1',
  'jungle': 'base2',
  'fossil': 'base3',
  'base-set-2': 'base4',
  'team-rocket': 'base5',
  'gym-heroes': 'gym1',
  'gym-challenge': 'gym2',
  'neo-genesis': 'neo1',
  'neo-discovery': 'neo2',
  'neo-revelation': 'neo3',
  'neo-destiny': 'neo4',
  'legendary-collection': 'base6',
  'expedition-base-set': 'ecard1',
  'aquapolis': 'ecard2',
  'skyridge': 'ecard3',
  'promo': 'basep',
  'southern-islands': 'si1',
};

// Common card name mappings for search
export const CARD_NAME_MAP: Record<string, string> = {
  'charizard-holo': 'Charizard',
  'blastoise-holo': 'Blastoise',
  'venusaur-holo': 'Venusaur',
  'pikachu': 'Pikachu',
  'mewtwo-holo': 'Mewtwo',
  'mew-holo': 'Mew',
  'lugia-holo': 'Lugia',
  'ho-oh-holo': 'Ho-Oh',
};
