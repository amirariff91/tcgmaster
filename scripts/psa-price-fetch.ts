/**
 * PSA Submission Price Analysis Script
 *
 * Fetches market pricing data for a 133-card PSA submission (Feb batch)
 * from the PokemonPriceTracker API, calculates grading ROI, and outputs
 * CSV + JSON files for analysis.
 *
 * Usage:
 *   npx tsx scripts/psa-price-fetch.ts phase1          # Card matching & mapping
 *   npx tsx scripts/psa-price-fetch.ts phase2          # Price fetch & ROI analysis
 *   npx tsx scripts/psa-price-fetch.ts phase1 --key=YOUR_API_KEY
 *
 * Environment variables:
 *   PPT_API_KEY - PokemonPriceTracker API key (or pass via --key flag)
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types (actual API response shapes) ─────────────────────────────────────

interface PPTVariantCondition {
  price: number;
  listings: number | null;
  priceString: string;
  lastUpdated: string;
}

interface PPTVariantInfo {
  printing: string;
  marketPrice: number;
  lowPrice: number;
  conditionUsed: string;
}

interface PPTCardPrices {
  market: number | null;
  low: number | null;
  sellers: number | null;
  listings: number | null;
  primaryPrinting: string | null;
  lastUpdated: string;
  variants: Record<string, Record<string, PPTVariantCondition>>;
}

interface PPTEbayGradeData {
  count: number;
  totalValue: number;
  averagePrice: number | null;
  medianPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  marketPrice7Day: number | null;
  marketPriceMedian7Day: number | null;
  dailyVolume7Day: number | null;
  marketTrend: string | null;
  lastMarketUpdate: string;
  smartMarketPrice?: {
    price: number;
    confidence: string;
    method: string;
    daysUsed: number;
  };
}

interface PPTCard {
  id: string;
  tcgPlayerId: string;
  name: string;
  setName: string;
  setId: number;
  cardNumber: string;
  rarity: string;
  artist?: string;
  prices: PPTCardPrices;
  variants?: Record<string, PPTVariantInfo>;
  printingsAvailable?: string[];
  ebay?: {
    updatedAt: string;
    salesByGrade: Record<string, PPTEbayGradeData>;
  };
  imageCdnUrl: string;
  lastScrapedAt: string;
}

interface PPTSearchResponse {
  data: PPTCard[];
  metadata: {
    total: number;
    count: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    language: string;
    apiCallsConsumed: {
      total: number;
      breakdown: { cards: number; history: number; ebay: number };
      costPerCard: number;
    };
  };
}

interface PPTSingleCardResponse {
  data: PPTCard;
  metadata: {
    apiCallsConsumed: {
      total: number;
      breakdown: { cards: number; history: number; ebay: number };
    };
  };
}

// ─── Script Types ────────────────────────────────────────────────────────────

interface SubmissionCard {
  no: number;
  name: string;
  cardNumber: string;
  expectedGrade: string; // raw string from PDF: "9", "9/10", "possible 10", "7/8", etc.
  justification: string;
}

interface CardMatch {
  tcgPlayerId: string;
  name: string;
  setName: string;
  cardNumber: string;
  printing: string;
  marketPrice: number | null;
  selected: boolean;
}

interface MappingEntry {
  no: number;
  name: string;
  cardNumber: string;
  expectedGrade: string;
  justification: string;
  searchQuery: string;
  matches: CardMatch[];
}

interface MappingFile {
  generatedAt: string;
  totalCards: number;
  cards: MappingEntry[];
}

interface GradeRow {
  grade: number | null;
  average: number | null;
  median: number | null;
  count: number;
  confidence: 'high' | 'medium' | 'low' | 'N/A';
}

interface PriceEntry {
  no: number;
  name: string;
  cardNumber: string;
  set: string;
  printing: string;
  expectedGrade: number;
  justification: string;
  lower: GradeRow;
  expected: GradeRow;
  upper: GradeRow;
  rawNmPrice: number | null;
  gradingCost: number;
  valueUplift: number | null;
  netRoi: number | null;
  roiPercent: number | null;
  isSelectedVariant: boolean;
  allPrintingsFound: string;
  tcgPlayerId: string;
}

interface PricesFile {
  generatedAt: string;
  gradingCostPerCard: number;
  totalCards: number;
  entries: PriceEntry[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PPT_BASE_URL = 'https://www.pokemonpricetracker.com/api/v2';
const OUTPUT_DIR = path.resolve(__dirname, '..', 'docs', 'psa-feb');
const GRADING_COST = 20; // PSA Value tier
const RATE_LIMIT_MS = 13_000; // 13s between requests (API: ~5 credits/min, each request costs 5 min-credits)
const SEARCH_LIMIT = 50; // Need higher limit to find vintage cards among modern results
const MAX_RETRIES = 3; // Retry on 429

// ─── 133 Cards from PSA Submission PDF ───────────────────────────────────────

const SUBMISSION_CARDS: SubmissionCard[] = [
  { no: 1, name: 'Dark Scizor', cardNumber: '9/105', expectedGrade: '7', justification: 'Front foil peel off, light scratch on holo, back a few indent (corner & bottom)' },
  { no: 2, name: 'Dark Celebi', cardNumber: '4/101', expectedGrade: '9/10', justification: 'Tiny whitening dot at the back' },
  { no: 3, name: 'Dark Slowking', cardNumber: '9/109', expectedGrade: '9', justification: 'Back left bottom whitening' },
  { no: 4, name: 'Dark Marowak', cardNumber: '7/109', expectedGrade: '9', justification: 'Back top left whitening/indent' },
  { no: 5, name: 'Dark Hypno', cardNumber: '6/109', expectedGrade: '9/10', justification: 'Very faint print line (back)' },
  { no: 6, name: 'Dark Steelix', cardNumber: '10/109', expectedGrade: '9', justification: 'Top bottom left (white dot) back' },
  { no: 7, name: 'Dark Marowak', cardNumber: '7/109', expectedGrade: 'possible 10', justification: '' },
  { no: 8, name: 'Shining Charizard', cardNumber: '107/105', expectedGrade: '6', justification: 'Front whitening, back top n bottom whitening' },
  { no: 9, name: 'Shining Mewtwo', cardNumber: '109/105', expectedGrade: '6/7', justification: 'Front top, back whitening' },
  { no: 10, name: 'Shining Kabutops', cardNumber: '108/105', expectedGrade: '7', justification: 'Back top whitening' },
  { no: 11, name: 'Shining Gyarados', cardNumber: '65/64', expectedGrade: '5', justification: 'Indent on holo' },
  { no: 12, name: 'Rocket\'s Mewtwo ex', cardNumber: '99/109', expectedGrade: '9', justification: '' },
  { no: 13, name: 'Kingdra', cardNumber: '8/111', expectedGrade: '4', justification: 'Indent on holo and back' },
  { no: 14, name: 'Larvitar', cardNumber: '62/109', expectedGrade: '9', justification: 'Back top corner and bottom corner' },
  { no: 15, name: 'Pikachu', cardNumber: '58/102', expectedGrade: '9', justification: 'Back whitening dot (tiny)' },
  { no: 16, name: 'Pikachu', cardNumber: '28', expectedGrade: '7', justification: 'Back top and corner' },
  { no: 17, name: 'Pikachu', cardNumber: '4', expectedGrade: '7', justification: 'Whitening at the back' },
  { no: 18, name: 'Pikachu', cardNumber: '27', expectedGrade: '6', justification: 'Front and back whitening' },
  { no: 19, name: 'Pikachu', cardNumber: '1', expectedGrade: '9', justification: 'Dot on back right side' },
  { no: 20, name: 'Pikachu', cardNumber: '25', expectedGrade: '9', justification: 'Top back whitening' },
  { no: 21, name: 'Pikachu', cardNumber: '26', expectedGrade: '9', justification: 'Whitening at the back' },
  { no: 22, name: 'Pikachu', cardNumber: '60/64', expectedGrade: '9/10', justification: 'Very tiny dot' },
  { no: 23, name: 'Dark Dragonite', cardNumber: '15/109', expectedGrade: '9', justification: 'Stain front (cannot be repaired)' },
  { no: 24, name: 'Espeon', cardNumber: 'H9/H32', expectedGrade: '9/10', justification: 'Very tiny dot corner back' },
  { no: 25, name: 'Lugia', cardNumber: '9/111', expectedGrade: '9', justification: 'Whitening dot at back top' },
  { no: 26, name: 'Dark Metal Energy', cardNumber: '94/109', expectedGrade: '9', justification: 'Whitening dot at back top' },
  { no: 27, name: 'Metal Energy', cardNumber: '19/111', expectedGrade: '9', justification: 'Indent in front' },
  { no: 28, name: 'Pikachu', cardNumber: '4', expectedGrade: '9', justification: 'Whitening at back' },
  { no: 29, name: 'Salamence', cardNumber: '10/97', expectedGrade: '9/10', justification: 'Very tiny whitening at the back corner' },
  { no: 30, name: 'Absol', cardNumber: '1/97', expectedGrade: '9/10', justification: 'Tiny whitening at corner' },
  { no: 31, name: 'Kyogre', cardNumber: '3/95', expectedGrade: 'possible 10', justification: 'One dot at back corner' },
  { no: 32, name: 'Metal Energy', cardNumber: '19/111', expectedGrade: 'possible 10', justification: 'Very faint print line (on holo)' },
  { no: 33, name: 'Delcatty', cardNumber: '5/109', expectedGrade: '9', justification: 'Centering back' },
  { no: 34, name: 'Jirachi', cardNumber: '8/101', expectedGrade: '10', justification: '' },
  { no: 35, name: 'Delcatty', cardNumber: '5/109', expectedGrade: '10', justification: '' },
  { no: 36, name: 'Nidoking', cardNumber: '6/112', expectedGrade: '9', justification: 'Deep scratch on holo top' },
  { no: 37, name: 'Misdreavus', cardNumber: '25/109', expectedGrade: '9/10', justification: 'Back bottom corner whitening' },
  { no: 38, name: 'Scyther', cardNumber: '45', expectedGrade: '9', justification: 'Back bottom' },
  { no: 39, name: 'Articuno', cardNumber: '48', expectedGrade: '8', justification: 'Centering front, back corner whitening' },
  { no: 40, name: 'Mareep', cardNumber: '67/109', expectedGrade: '9/10', justification: '' },
  { no: 41, name: 'Hitmonchan', cardNumber: '2', expectedGrade: '9/10', justification: 'Light scratch on holo (faint)' },
  { no: 42, name: 'Electabuzz', cardNumber: '1', expectedGrade: '8', justification: 'Light holo scratch, whitening dot back' },
  { no: 43, name: 'Pichu', cardNumber: '35', expectedGrade: '9', justification: 'Back whitening dot corner and left side' },
  { no: 44, name: 'Cubone', cardNumber: '51/109', expectedGrade: '9/10', justification: 'One corner dot' },
  { no: 45, name: 'Ho-Oh', cardNumber: '9/95', expectedGrade: '6', justification: 'Centering off, back deep scratch middle, scratch and whitening' },
  { no: 46, name: 'Cool Porygon', cardNumber: '15', expectedGrade: '9/10', justification: 'Tiny dot back corner' },
  { no: 47, name: 'Golem', cardNumber: '148/144', expectedGrade: '9', justification: 'Light scratch on holo (faint)' },
  { no: 48, name: 'Nidoking', cardNumber: 'H18/H32', expectedGrade: '9', justification: 'Tiny dot back corner' },
  { no: 49, name: 'Poliwrath', cardNumber: 'H24/H32', expectedGrade: '10', justification: '' },
  { no: 50, name: 'Lanturn', cardNumber: 'H15/H32', expectedGrade: '9', justification: 'Whitening dot back bottom' },
  { no: 51, name: 'Alakazam', cardNumber: 'H1/H32', expectedGrade: '10', justification: '' },
  { no: 52, name: 'Articuno', cardNumber: 'H3/H32', expectedGrade: 'possible 10', justification: 'Back centering (left right)' },
  { no: 53, name: 'Blastoise', cardNumber: '4/165', expectedGrade: '8', justification: 'Front holo scratch, back centering' },
  { no: 54, name: 'Poliwrath', cardNumber: 'H24/H32', expectedGrade: '10', justification: '' },
  { no: 55, name: 'Arcanine', cardNumber: 'H2/H32', expectedGrade: '10', justification: '' },
  { no: 56, name: 'Blastoise', cardNumber: '4/165', expectedGrade: '8', justification: 'Front holo scratch, top bottom back whitening' },
  { no: 57, name: 'Gyarados', cardNumber: 'H10/H32', expectedGrade: '8/9', justification: 'Holo scratch, corner left whitening' },
  { no: 58, name: 'Umbreon', cardNumber: 'H30/H32', expectedGrade: '8', justification: 'Deep holo scratch, back corner dot' },
  { no: 59, name: 'Raichu', cardNumber: 'H25/H32', expectedGrade: 'possible 10', justification: '' },
  { no: 60, name: 'Tyranitar', cardNumber: '29/165', expectedGrade: '8', justification: 'Holo scratch front, whitening back' },
  { no: 61, name: 'Piloswine', cardNumber: 'H22/H32', expectedGrade: '9', justification: 'Whitening at the back bottom' },
  { no: 62, name: 'Suicune', cardNumber: 'H25/H32', expectedGrade: '9', justification: 'Whitening at top' },
  { no: 63, name: 'Politoed', cardNumber: 'H23/H32', expectedGrade: '10', justification: '' },
  { no: 64, name: 'Dewgong', cardNumber: 'H6/H32', expectedGrade: '9/10', justification: 'Very tiny dot at corner right back, centering back left right off' },
  { no: 65, name: 'Magneton', cardNumber: 'H19/H32', expectedGrade: '8/9', justification: 'Holo scratch, edges indent back top, corner back whitening' },
  { no: 66, name: 'Rhydon', cardNumber: 'H27/H32', expectedGrade: '9/10', justification: 'Tiny dot at back bottom and left' },
  { no: 67, name: 'Dark Ivysaur', cardNumber: '6', expectedGrade: '9', justification: 'Tiny dot corner top, top, bottom left' },
  { no: 68, name: 'Venusaur', cardNumber: '30/165', expectedGrade: '9', justification: 'Very tiny dot at the corner back, top edges' },
  { no: 69, name: 'Kingdra', cardNumber: '12/109', expectedGrade: '9/10', justification: 'Centering at the back' },
  { no: 70, name: 'Mew', cardNumber: '55/165', expectedGrade: '7/8', justification: 'Front light scratch, back whitening' },
  { no: 71, name: 'Rocket\'s Sneasel', cardNumber: '5', expectedGrade: '9', justification: 'Centering back off, right back and top corner whitening' },
  { no: 72, name: 'Rocket\'s Scizor', cardNumber: '4', expectedGrade: '9', justification: 'Whitening dot at the back, centering left right' },
  { no: 73, name: 'Dugtrio', cardNumber: '10/165', expectedGrade: '8', justification: 'Top front stain, holo scratch, white dot back corner' },
  { no: 74, name: 'Butterfree', cardNumber: '51/165', expectedGrade: '5', justification: 'Top corner indent, back left indent, pin mark, small whitening' },
  { no: 75, name: 'Raichu', cardNumber: 'H25/H32', expectedGrade: '8', justification: 'Back whitening' },
  { no: 76, name: 'Crobat', cardNumber: 'H5/H32', expectedGrade: '9/10', justification: 'Tiny dot at the corner of the back' },
  { no: 77, name: 'Typhlosion', cardNumber: '28/165', expectedGrade: '5', justification: 'Front top and left indent, back indent and whitening' },
  { no: 78, name: 'Tentacruel', cardNumber: 'H26/H32', expectedGrade: '8', justification: 'Whitening dot at corner and left back' },
  { no: 79, name: 'Sandslash', cardNumber: '93/144', expectedGrade: '7/8', justification: 'Whitening at the back' },
  { no: 80, name: 'Bellossom', cardNumber: 'H5/H32', expectedGrade: '9', justification: 'White dot at the back' },
  { no: 81, name: 'Machamp', cardNumber: '16/165', expectedGrade: '8', justification: 'Holo light scratch, back whitening' },
  { no: 82, name: 'Arcanine', cardNumber: 'H2/H32', expectedGrade: '9', justification: 'Holo scratch, white dot at top back' },
  { no: 83, name: 'Dark Venusaur', cardNumber: '1', expectedGrade: '9', justification: 'Whitening at the back' },
  { no: 84, name: 'Xatu', cardNumber: 'H32/H32', expectedGrade: '9/10', justification: 'Tiny dot back corner' },
  { no: 85, name: 'Typhlosion', cardNumber: '28/165', expectedGrade: '7', justification: 'Holo scratch, back scratch, right side indent' },
  { no: 86, name: 'Nidoqueen', cardNumber: 'H21/H32', expectedGrade: '9/10', justification: 'Back top indent' },
  { no: 87, name: 'Golem', cardNumber: '148/144', expectedGrade: '9', justification: 'Whitening at the back left' },
  { no: 88, name: 'Blissey', cardNumber: '6/147', expectedGrade: '8', justification: 'Light holo scratch, whitening dot at the back' },
  { no: 89, name: 'Scizor', cardNumber: 'H21/H32', expectedGrade: '9/10', justification: 'Very tiny dot at the back bottom' },
  { no: 90, name: 'Nidoking', cardNumber: '150/147', expectedGrade: '9/10', justification: 'Tiny dot at the corner back' },
  { no: 91, name: 'Blissey', cardNumber: 'H6/H32', expectedGrade: '9/10', justification: 'Back tiny dot on left' },
  { no: 92, name: 'Tyranitar', cardNumber: '40/147', expectedGrade: '6', justification: 'Front (top, left indent, deep scratch), back (whitening)' },
  { no: 93, name: 'Alakazam', cardNumber: '1/165', expectedGrade: '7/8', justification: 'Top front indent, ink stain, back whitening dot corner and right, light scratch' },
  { no: 94, name: 'Charizard', cardNumber: '6/165', expectedGrade: '6', justification: 'Top indent, holo light scratch, back whitening and indent dot, scratch' },
  { no: 95, name: 'Jumpluff', cardNumber: '7/111', expectedGrade: '10', justification: '' },
  { no: 96, name: 'Pichu', cardNumber: '12/111', expectedGrade: '7', justification: 'Holo scratch, back whitening' },
  { no: 97, name: 'Hitmonlee', cardNumber: '13/110', expectedGrade: '9/10', justification: 'Tiny dot at corner back' },
  { no: 98, name: 'Azumarill', cardNumber: '2/111', expectedGrade: '9/10', justification: 'Holo printline' },
  { no: 99, name: 'Raikou', cardNumber: '13/64', expectedGrade: '7', justification: 'Holo indent, scratch, back scratch, whitening' },
  { no: 100, name: 'Charizard', cardNumber: '4/102', expectedGrade: '7', justification: 'Holo scratch, back whitening over the edges' },
  { no: 101, name: 'Ampharos', cardNumber: '1/64', expectedGrade: '9', justification: 'Holo light scratch, white dot corner back, indent top back' },
  { no: 102, name: 'Blaine\'s Moltres', cardNumber: '1/132', expectedGrade: '9', justification: 'Whitening at back bottom' },
  { no: 103, name: 'Entei', cardNumber: '6/64', expectedGrade: '8', justification: 'Front bottom indent, back top right and bottom indent' },
  { no: 104, name: 'Dark Blastoise', cardNumber: '3/82', expectedGrade: '8', justification: 'Holo scratch, whitening bottom back' },
  { no: 105, name: 'Ampharos', cardNumber: '1/64', expectedGrade: '7', justification: 'Holo light scratch, back whitening, indent, scratch' },
  { no: 106, name: 'Charizard', cardNumber: '006', expectedGrade: '8', justification: 'Centering front, indent and scratch bottom back' },
  { no: 107, name: 'Dark Donphan', cardNumber: '3/105', expectedGrade: '8', justification: 'Light scratch on holo, back few white dot' },
  { no: 108, name: 'Meganium', cardNumber: '10/111', expectedGrade: '7', justification: 'Silvering front, holo light scratch, back indent, whitening' },
  { no: 109, name: 'Koga', cardNumber: '19/132', expectedGrade: '8', justification: 'Holo light scratch, whitening at the back bottom' },
  { no: 110, name: 'Unown', cardNumber: '14/175', expectedGrade: '8', justification: 'Back centering, few whitening' },
  { no: 111, name: 'Pichu', cardNumber: '12/111', expectedGrade: '6', justification: 'Holo scratch on holo, few indent front n back, whitening' },
  { no: 112, name: 'Espeon', cardNumber: '1/75', expectedGrade: '4', justification: 'Front crease, back whitening, holo light scratch' },
  { no: 113, name: 'Slowking', cardNumber: '14/111', expectedGrade: '8/9', justification: 'Holo light scratch, few whitening at the back' },
  { no: 114, name: 'Venusaur', cardNumber: '13', expectedGrade: '7', justification: 'Holo light scratch, back whitening, indent top back' },
  { no: 115, name: 'Wobbuffet', cardNumber: '16/75', expectedGrade: '9/10', justification: 'Front very light scratch, back tiny dot' },
  { no: 116, name: 'Light Arcanine', cardNumber: '12/105', expectedGrade: '7', justification: 'Few indent and whitening at the back' },
  { no: 117, name: 'Light Dragonite', cardNumber: '14/105', expectedGrade: '7/8', justification: 'Whitening at the back top and bottom' },
  { no: 118, name: 'Aerodactyl ex', cardNumber: '94/100', expectedGrade: '9', justification: 'White dot at corner' },
  { no: 119, name: 'Kyogre ex', cardNumber: '001', expectedGrade: '3', justification: 'Front top and bottom crease, back whitening' },
  { no: 120, name: 'Alakazam', cardNumber: '1/110', expectedGrade: '7', justification: 'Front printline, light scratch. Back white dot' },
  { no: 121, name: 'Blaziken ex', cardNumber: '89/95', expectedGrade: '8', justification: 'Tiny white dot at the corner back, centering front n bottom, few scratch' },
  { no: 122, name: 'Ampharos ex', cardNumber: '89/97', expectedGrade: '10', justification: '' },
  { no: 123, name: 'Hitmonchan ex', cardNumber: '98/109', expectedGrade: '9', justification: 'Front light scratch' },
  { no: 124, name: 'Raichu ex', cardNumber: '98/100', expectedGrade: '9/10', justification: 'One dot corner back top left' },
  { no: 125, name: 'Mewtwo ex', cardNumber: '101/109', expectedGrade: '9', justification: 'Centering front (left right), back few indent and whitening bottom corner' },
  { no: 126, name: 'Mr. Mime ex', cardNumber: '110/112', expectedGrade: '9', justification: 'Holo front scratch, whitening back left' },
  { no: 127, name: 'Zapdos ex', cardNumber: '116/112', expectedGrade: '9/10', justification: 'Very tiny dot at the top back corner' },
  { no: 128, name: 'Kabutops ex', cardNumber: '97/100', expectedGrade: '9', justification: 'Few light scratch in front, tiny dot whitening corner top' },
  { no: 129, name: 'Wailord ex', cardNumber: '100/100', expectedGrade: '9', justification: 'Back few corner white dot' },
  { no: 130, name: 'Sneasel ex', cardNumber: '103/109', expectedGrade: '9', justification: 'Front light scratch, back few white dot corner' },
  { no: 131, name: 'Gardevoir ex', cardNumber: '94/100', expectedGrade: '9', justification: 'Top front indent, centering front left right, back very tiny dot corner' },
  { no: 132, name: 'Lapras ex', cardNumber: '99/109', expectedGrade: '8', justification: 'Few light scratch, back top corner whitening' },
  { no: 133, name: 'Gardevoir ex', cardNumber: '94/100', expectedGrade: '9', justification: 'White dot top corner' },
];

// ─── Corrections Map ─────────────────────────────────────────────────────────

interface CorrectionEntry {
  searchName?: string;
  searchNumber?: string;
  setId?: number; // API numeric set ID for set-specific filtering
  language?: string;
  notes?: string;
}

// Set ID constants (tcgPlayerNumericId from the /sets API)
const SET_IDS = {
  BASE_SET: 604,
  JUNGLE: 635,
  WOTC_PROMO: 1418,
  NEO_GENESIS: 1396,
  NEO_DISCOVERY: 1434,
  NEO_REVELATION: 1389,
  NEO_DESTINY: 1444,
  LEGENDARY_COLLECTION: 1374,
  EXPEDITION: 1375,
  AQUAPOLIS: 1397,
  SKYRIDGE: 1372,
  RUBY_AND_SAPPHIRE: 1393,
  SANDSTORM: 1392,
  DRAGON: 1376,
  TEAM_MAGMA_VS_TEAM_AQUA: 1377,
  HIDDEN_LEGENDS: 1416,
  FIRERED_AND_LEAFGREEN: 1419,
  TEAM_ROCKET_RETURNS: 1428,
  TEAM_ROCKET: 1373,
  CALL_OF_LEGENDS: 1415,
} as const;

const CORRECTIONS: Record<number, CorrectionEntry> = {
  // Pikachu variants — need setId to find vintage among 50+ modern results
  15: { searchName: 'Pikachu', searchNumber: '58/102', setId: SET_IDS.BASE_SET, notes: 'Korean Base Set -> English equivalent' },
  16: { searchName: 'Surfing Pikachu', searchNumber: '28', setId: SET_IDS.WOTC_PROMO, notes: 'French name -> English Surfing Pikachu promo' },
  17: { searchName: 'Pikachu', searchNumber: '4', setId: SET_IDS.WOTC_PROMO, notes: 'Black Star Promo #4' },
  18: { searchName: 'Pikachu', searchNumber: '27', setId: SET_IDS.WOTC_PROMO, notes: 'Black Star Promo #27' },
  19: { searchName: 'Pikachu', searchNumber: '1', setId: SET_IDS.WOTC_PROMO, notes: 'Black Star Promo #1' },
  20: { searchName: 'Flying Pikachu', searchNumber: '25', setId: SET_IDS.WOTC_PROMO, notes: 'German name -> English Flying Pikachu promo' },
  21: { searchName: 'Pikachu', searchNumber: '26', setId: SET_IDS.WOTC_PROMO, notes: 'Black Star Promo #26' },
  22: { searchName: 'Pikachu', searchNumber: '60/64', setId: SET_IDS.JUNGLE, notes: 'Jungle Pikachu' },
  25: { searchName: 'Lugia', searchNumber: '9/111', setId: SET_IDS.NEO_GENESIS, notes: '1st Edition Neo Genesis' },
  27: { searchName: 'Metal Energy', searchNumber: '19/111', setId: SET_IDS.NEO_GENESIS, notes: 'Neo Genesis Metal Energy' },
  28: { searchName: 'Pikachu', searchNumber: '4', setId: SET_IDS.WOTC_PROMO, notes: 'Black Star Promo #4' },
  32: { searchName: 'Metal Energy', searchNumber: '19/111', setId: SET_IDS.NEO_GENESIS, notes: 'Neo Genesis Metal Energy' },
  36: { searchName: 'Nidoking', searchNumber: '6/112', setId: SET_IDS.FIRERED_AND_LEAFGREEN, notes: 'FireRed & LeafGreen' },
  38: { searchName: 'Scyther', searchNumber: '45', setId: SET_IDS.WOTC_PROMO, notes: 'Typo correction: sycther -> Scyther' },
  41: { searchName: 'Hitmonchan', searchNumber: '2', notes: 'Black Star Promo #2' },
  42: { searchName: 'Electabuzz', searchNumber: '1', notes: 'Black Star Promo #1' },
  43: { searchName: 'Pichu', searchNumber: '35', setId: SET_IDS.WOTC_PROMO, notes: 'Black Star Promo #35' },
  45: { searchName: 'Ho-Oh', searchNumber: '9/95', setId: SET_IDS.CALL_OF_LEGENDS, notes: 'Call of Legends Ho-Oh' },
  46: { searchName: 'Cool Porygon', searchNumber: '15', setId: SET_IDS.WOTC_PROMO, notes: 'Black Star Promo #15' },
  // Expedition cards — popular names need setId
  53: { searchName: 'Blastoise', searchNumber: '4/165', setId: SET_IDS.EXPEDITION, notes: 'Expedition Blastoise' },
  56: { searchName: 'Blastoise', searchNumber: '4/165', setId: SET_IDS.EXPEDITION, notes: 'Expedition Blastoise' },
  60: { searchName: 'Tyranitar', searchNumber: '29/165', setId: SET_IDS.EXPEDITION, notes: 'Expedition Tyranitar' },
  67: { searchName: 'Dark Ivysaur', searchNumber: '6/82', notes: 'Team Rocket' },
  70: { searchName: 'Mew', searchNumber: '55/165', setId: SET_IDS.EXPEDITION, notes: 'Expedition Mew' },
  71: { searchName: "Rocket's Sneasel", searchNumber: '5', notes: 'Best of Game promo' },
  72: { searchName: "Rocket's Scizor", searchNumber: '4', notes: 'Best of Game promo' },
  74: { searchName: 'Butterfree', searchNumber: '38/165', setId: SET_IDS.EXPEDITION, notes: 'Expedition Butterfree (non-holo, #38 not #51)' },
  79: { searchName: 'Sandslash', searchNumber: '93/144', setId: SET_IDS.SKYRIDGE, notes: 'Skyridge Sandslash' },
  80: { searchName: 'Bellossom', notes: 'Typo correction: bellosom -> Bellossom' },
  81: { searchName: 'Machamp', searchNumber: '16/165', setId: SET_IDS.EXPEDITION, notes: 'Expedition Machamp' },
  83: { searchName: 'Dark Venusaur', searchNumber: '7/9', notes: 'Best of Game Promos (Team Rocket version not in API)' },
  88: { searchName: 'Blissey', searchNumber: '6/147', setId: SET_IDS.AQUAPOLIS, notes: 'Reverse Holo printing' },
  91: { searchName: 'Blissey', setId: SET_IDS.AQUAPOLIS, notes: 'Holo printing (Aquapolis)' },
  92: { searchName: 'Tyranitar', searchNumber: '40/147', setId: SET_IDS.AQUAPOLIS, notes: 'Reverse Holo printing' },
  93: { searchName: 'Alakazam', searchNumber: '1/165', setId: SET_IDS.EXPEDITION, notes: 'Holo printing (Expedition)' },
  94: { searchName: 'Charizard', searchNumber: '6/165', setId: SET_IDS.EXPEDITION, notes: 'Expedition Charizard' },
  95: { searchName: 'Jumpluff', searchNumber: '7/111', setId: SET_IDS.NEO_GENESIS, notes: '1st Edition Neo Genesis' },
  98: { searchName: 'Azumarill', searchNumber: '2/111', setId: SET_IDS.NEO_GENESIS, notes: '1st Edition Neo Genesis' },
  100: { searchName: 'Charizard', searchNumber: '4/102', setId: SET_IDS.BASE_SET, notes: 'Base Set Charizard' },
  101: { searchName: 'Ampharos', searchNumber: '1/64', setId: SET_IDS.NEO_REVELATION, notes: 'Neo Revelation' },
  102: { searchName: "Blaine's Moltres", searchNumber: '1/132', notes: '1st Edition, typo: moltress -> Moltres' },
  105: { searchName: 'Ampharos', searchNumber: '1/64', setId: SET_IDS.NEO_REVELATION, notes: '1st Edition Neo Revelation' },
  106: { searchName: 'Charizard', searchNumber: '4/102', setId: SET_IDS.BASE_SET, notes: 'Japanese Base Set Charizard -> English Base Set proxy (JPN not in API)' },
  108: { searchName: 'Meganium', searchNumber: '10/111', setId: SET_IDS.NEO_GENESIS, notes: 'Neo Genesis Meganium' },
  109: { searchName: 'Koga', searchNumber: '19/132', notes: '1st Edition Gym Challenge' },
  110: { searchName: 'Unown', searchNumber: '14/75', setId: SET_IDS.NEO_DISCOVERY, notes: 'Unown [A] Neo Discovery (14/175 likely typo for 14/75; Aquapolis Unown not in API)' },
  111: { searchName: 'Pichu', searchNumber: '12/111', setId: SET_IDS.NEO_GENESIS, notes: '1st Edition Neo Genesis' },
  112: { searchName: 'Espeon', searchNumber: '1/75', setId: SET_IDS.NEO_DISCOVERY, notes: 'Neo Discovery Espeon' },
  113: { searchName: 'Slowking', searchNumber: '14/111', setId: SET_IDS.NEO_GENESIS, notes: 'Neo Genesis Slowking' },
  114: { searchName: 'Venusaur', searchNumber: '13', setId: SET_IDS.WOTC_PROMO, notes: 'Black Star Promo #13' },
  119: { searchName: 'Kyogre ex', searchNumber: '001', notes: 'Promo card' },
  120: { searchName: 'Alakazam', searchNumber: '1/110', setId: SET_IDS.LEGENDARY_COLLECTION, notes: 'Legendary Collection' },
  121: { searchName: 'Blaziken ex', searchNumber: '89/95', setId: SET_IDS.TEAM_MAGMA_VS_TEAM_AQUA, notes: 'Team Magma vs Team Aqua' },
  123: { searchName: 'Hitmonchan ex', searchNumber: '98/109', setId: SET_IDS.RUBY_AND_SAPPHIRE, notes: 'Ruby and Sapphire (not Rockets)' },
  125: { searchName: 'Mewtwo ex', searchNumber: '101/109', setId: SET_IDS.RUBY_AND_SAPPHIRE, notes: 'Ruby and Sapphire (not Rockets)' },
  130: { searchName: 'Sneasel ex', searchNumber: '103/109', setId: SET_IDS.RUBY_AND_SAPPHIRE, notes: 'Ruby and Sapphire (not Rockets)' },
  131: { searchName: 'Gardevoir ex', searchNumber: '94/100', setId: SET_IDS.SANDSTORM, notes: 'Sandstorm Gardevoir ex' },
  132: { searchName: 'Lapras ex', searchNumber: '99/109', setId: SET_IDS.RUBY_AND_SAPPHIRE, notes: 'Ruby and Sapphire' },
  133: { searchName: 'Gardevoir ex', searchNumber: '94/100', setId: SET_IDS.SANDSTORM, notes: 'Sandstorm Gardevoir ex' },
};

// ─── API Client ──────────────────────────────────────────────────────────────

let authMethod: 'bearer' | 'x-api-key' | null = null;

async function pptFetch(endpoint: string, apiKey: string, retryCount = 0): Promise<any> {
  const url = `${PPT_BASE_URL}${endpoint}`;

  const makeRequest = async (headers: Record<string, string>): Promise<Response> => {
    return fetch(url, { headers: { ...headers, 'Content-Type': 'application/json' } });
  };

  let response: Response;

  if (authMethod === 'bearer') {
    response = await makeRequest({ Authorization: `Bearer ${apiKey}` });
  } else if (authMethod === 'x-api-key') {
    response = await makeRequest({ 'X-API-Key': apiKey });
  } else {
    response = await makeRequest({ Authorization: `Bearer ${apiKey}` });
    if (response.status === 401 || response.status === 403) {
      console.log('  Bearer auth failed, trying X-API-Key...');
      response = await makeRequest({ 'X-API-Key': apiKey });
      if (response.ok) {
        authMethod = 'x-api-key';
        console.log('  Auth method: X-API-Key');
      }
    } else if (response.ok) {
      authMethod = 'bearer';
      console.log('  Auth method: Bearer');
    }
  }

  // Handle rate limiting with retry
  if (response.status === 429 && retryCount < MAX_RETRIES) {
    const waitSec = 65 + retryCount * 15;
    process.stdout.write(`RATE LIMITED, waiting ${waitSec}s...`);
    await sleep(waitSec * 1000);
    return pptFetch(endpoint, apiKey, retryCount + 1);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`API ${response.status}: ${errorBody.substring(0, 200)}`);
  }

  return response.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Phase 1: Card Matching & Mapping ────────────────────────────────────────

function buildSearchQuery(card: SubmissionCard): string {
  const correction = CORRECTIONS[card.no];
  // Search by name only — the API doesn't handle "name + number" queries well.
  // Card number matching is done locally after results come back.
  return correction?.searchName || card.name;
}

function normalizeCardNumber(num: string): string {
  // Normalize card numbers for comparison: lowercase, strip whitespace,
  // remove leading zeros within each segment (e.g., H02 -> H2, 009 -> 9, 030/165 -> 30/165)
  return num.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(?:^|(?<=[^0-9]))0+(?=\d)/g, '');
}

function inferPrintingPreference(card: SubmissionCard): string | null {
  const nameLower = card.name.toLowerCase();
  const correction = CORRECTIONS[card.no];
  const notes = correction?.notes?.toLowerCase() || '';

  if (nameLower.includes('reverse') || notes.includes('reverse holo')) return 'Reverse Holofoil';
  if (nameLower.includes('1st ed') || nameLower.includes('first ed') || notes.includes('1st edition')) return '1st Edition Holofoil';
  if (card.cardNumber.toLowerCase().startsWith('h')) return 'Holofoil';
  if (nameLower.includes('holo') || notes.includes('holo')) return 'Holofoil';
  return null;
}

function guessPrinting(card: PPTCard): string {
  // Use printingsAvailable or primaryPrinting from the API
  if (card.prices?.primaryPrinting) return card.prices.primaryPrinting;
  const rarity = (card.rarity || '').toLowerCase();
  if (rarity.includes('holo')) return 'Holofoil';
  if (rarity === 'rare') return 'Holofoil';
  return card.rarity || 'Normal';
}

function cardNumbersMatch(apiNumber: string, targetNumber: string): 'exact' | 'close' | 'none' {
  const a = normalizeCardNumber(apiNumber);
  const t = normalizeCardNumber(targetNumber);

  // Exact match (after normalization)
  if (a === t) return 'exact';

  // Handle H-numbers: API might store "H10" and target is "h10/h32"
  const tBase = t.split('/')[0];
  const aBase = a.split('/')[0];
  if (aBase === tBase) return 'exact';

  // Handle leading zeros: API "009/105" vs target "9/105"
  if (a.replace(/^0+/, '') === t.replace(/^0+/, '')) return 'exact';

  return 'none';
}

// Sets/products that should NEVER be selected as the primary match
const EXCLUDED_SET_PATTERNS = [
  /world championship/i,
  /deck exclusives/i,
  /jumbo cards/i,
  /\bstaff\b/i,
  /trainer kit/i,
];

function isExcludedSet(setName: string): boolean {
  return EXCLUDED_SET_PATTERNS.some((p) => p.test(setName));
}

function selectBestMatch(matches: PPTCard[], card: SubmissionCard): CardMatch[] {
  const printingPref = inferPrintingPreference(card);
  const correction = CORRECTIONS[card.no];
  const targetNumber = correction?.searchNumber || card.cardNumber;
  const targetName = (correction?.searchName || card.name).toLowerCase();

  const cardMatches: CardMatch[] = matches.map((m) => {
    const printing = guessPrinting(m);
    return {
      tcgPlayerId: m.tcgPlayerId,
      name: m.name,
      setName: m.setName,
      cardNumber: m.cardNumber,
      printing,
      marketPrice: m.prices?.market ?? null,
      selected: false,
    };
  });

  // Score each match: higher is better
  const scores = matches.map((m, i) => {
    const cm = cardMatches[i];
    if (isExcludedSet(cm.setName)) return -1000; // Never select these

    let score = 0;
    const nameMatch = m.name.toLowerCase().includes(targetName) || targetName.includes(m.name.toLowerCase());
    if (!nameMatch) return -500;

    const numMatch = cardNumbersMatch(m.cardNumber, targetNumber);
    if (numMatch === 'exact') score += 100;

    // Printing preference bonus
    if (printingPref && cm.printing.toLowerCase().includes(printingPref.toLowerCase().split(' ')[0])) {
      score += 10;
    }

    // Prefer non-"Celebrations" over Celebrations reprints
    if (cm.setName.toLowerCase().includes('celebrations')) score -= 5;

    return score;
  });

  // Select the single best match
  let bestIdx = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > bestScore) {
      bestScore = scores[i];
      bestIdx = i;
    }
  }

  if (bestIdx >= 0) {
    cardMatches[bestIdx].selected = true;
  }

  return cardMatches;
}

async function runPhase1(apiKey: string): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Phase 1: Card Matching & Mapping');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Cards to process: ${SUBMISSION_CARDS.length}`);
  console.log(`  Rate limit delay: ${RATE_LIMIT_MS / 1000}s per request`);
  console.log(`  Estimated time: ~${Math.ceil(SUBMISSION_CARDS.length * RATE_LIMIT_MS / 60_000)} minutes`);
  console.log(`  Output dir: ${OUTPUT_DIR}`);
  console.log('');

  const mappingEntries: MappingEntry[] = [];
  let matched = 0;
  let noMatch = 0;
  let errors = 0;

  for (let i = 0; i < SUBMISSION_CARDS.length; i++) {
    const card = SUBMISSION_CARDS[i];
    const query = buildSearchQuery(card);
    const correction = CORRECTIONS[card.no];

    const progress = `[${String(i + 1).padStart(3, '0')}/${SUBMISSION_CARDS.length}]`;
    process.stdout.write(`${progress} #${card.no} ${card.name} ${card.cardNumber} -> "${query}" ... `);

    try {
      let endpoint = `/cards?search=${encodeURIComponent(query)}&includeEbay=false&limit=${SEARCH_LIMIT}`;
      if (correction?.setId) {
        endpoint += `&setId=${correction.setId}`;
      }
      if (correction?.language) {
        endpoint += `&language=${correction.language}`;
      }

      const result: PPTSearchResponse = await pptFetch(endpoint, apiKey);
      const apiCards = result.data || [];

      if (apiCards.length === 0) {
        mappingEntries.push({
          no: card.no, name: card.name, cardNumber: card.cardNumber,
          expectedGrade: card.expectedGrade, justification: card.justification,
          searchQuery: query, matches: [],
        });
        noMatch++;
        console.log('NO MATCH');
      } else {
        const cardMatches = selectBestMatch(apiCards, card);
        mappingEntries.push({
          no: card.no, name: card.name, cardNumber: card.cardNumber,
          expectedGrade: card.expectedGrade, justification: card.justification,
          searchQuery: query, matches: cardMatches,
        });
        matched++;
        const sel = cardMatches.find((m) => m.selected);
        console.log(`${apiCards.length} results -> ${sel?.name || '?'} [${sel?.setName || ''}] $${sel?.marketPrice ?? '?'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`ERROR: ${msg}`);
      mappingEntries.push({
        no: card.no, name: card.name, cardNumber: card.cardNumber,
        expectedGrade: card.expectedGrade, justification: card.justification,
        searchQuery: query, matches: [],
      });
      errors++;
    }

    await sleep(RATE_LIMIT_MS);
  }

  // Write mapping.json
  const mappingFile: MappingFile = {
    generatedAt: new Date().toISOString(),
    totalCards: SUBMISSION_CARDS.length,
    cards: mappingEntries,
  };
  const jsonPath = path.join(OUTPUT_DIR, 'mapping.json');
  fs.writeFileSync(jsonPath, JSON.stringify(mappingFile, null, 2));
  console.log(`\nWritten ${jsonPath}`);

  // Write mapping.csv
  const csvLines: string[] = [
    'No,Card,CardNumber,ExpectedGrade,SearchQuery,MatchedName,MatchedCardNumber,MatchedSet,Printing,TCGPlayerId,MarketPrice,Selected',
  ];
  for (const entry of mappingEntries) {
    if (entry.matches.length === 0) {
      csvLines.push(csvRow([entry.no, entry.name, entry.cardNumber, entry.expectedGrade, entry.searchQuery, 'NO MATCH', '', '', '', '', '', 'N']));
    } else {
      for (const match of entry.matches) {
        csvLines.push(csvRow([entry.no, entry.name, entry.cardNumber, entry.expectedGrade, entry.searchQuery, match.name, match.cardNumber, match.setName, match.printing, match.tcgPlayerId, match.marketPrice ?? '', match.selected ? 'Y' : 'N']));
      }
    }
  }
  const csvPath = path.join(OUTPUT_DIR, 'mapping.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'));
  console.log(`Written ${csvPath}`);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Results: ${matched} matched, ${noMatch} no match, ${errors} errors`);
  console.log('  Review mapping.csv in Excel/Sheets, then run phase2');
  console.log('═══════════════════════════════════════════════════════════');
}

// ─── Phase 2: Price Fetch & ROI Analysis ─────────────────────────────────────

function parseExpectedGrades(grade: string): number[] {
  const g = grade.trim().toLowerCase();
  if (g.includes('possible')) {
    const num = parseInt(g.replace(/[^0-9]/g, ''), 10);
    return [num - 1, num];
  }
  if (g.includes('/')) {
    const parts = g.split('/').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n));
    if (parts.length === 2) return parts;
  }
  const single = parseInt(g, 10);
  if (!isNaN(single)) return [single];
  return [parseInt(g.replace(/[^0-9]/g, ''), 10) || 9];
}

function getGradeData(
  salesByGrade: Record<string, PPTEbayGradeData> | undefined,
  grade: number | null
): GradeRow {
  if (grade === null || !salesByGrade) {
    return { grade: null, average: null, median: null, count: 0, confidence: 'N/A' };
  }

  const key = `psa${grade}`;
  const data = salesByGrade[key];

  if (!data) {
    return { grade, average: null, median: null, count: 0, confidence: 'low' };
  }

  let confidence: 'high' | 'medium' | 'low';
  if (data.count >= 5) confidence = 'high';
  else if (data.count >= 2) confidence = 'medium';
  else confidence = 'low';

  return {
    grade,
    average: data.averagePrice,  // API uses averagePrice, not average
    median: data.medianPrice,    // API uses medianPrice, not median
    count: data.count,
    confidence,
  };
}

function extractNmPrice(card: PPTCard): number | null {
  // Try to find Near Mint price from variants
  if (card.prices?.variants) {
    for (const [_printing, conditions] of Object.entries(card.prices.variants)) {
      for (const [condName, condData] of Object.entries(conditions)) {
        if (condName.toLowerCase().includes('near mint')) {
          return (condData as PPTVariantCondition).price;
        }
      }
    }
  }
  // Fallback to market price
  return card.prices?.market ?? null;
}

async function runPhase2(apiKey: string): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Phase 2: Price Fetch & ROI Analysis');
  console.log('═══════════════════════════════════════════════════════════');

  const jsonPath = path.join(OUTPUT_DIR, 'mapping.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`ERROR: ${jsonPath} not found. Run phase1 first.`);
    process.exit(1);
  }

  const mapping: MappingFile = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`  Loaded ${mapping.cards.length} cards from mapping.json`);
  console.log(`  Rate limit delay: ${RATE_LIMIT_MS / 1000}s per request`);
  const selectedCount = mapping.cards.filter((c) => c.matches.some((m) => m.selected)).length;
  console.log(`  Cards with selected match: ${selectedCount}`);
  console.log(`  Estimated time: ~${Math.ceil(selectedCount * RATE_LIMIT_MS / 60_000)} minutes`);
  console.log('');

  const priceEntries: PriceEntry[] = [];
  let fetched = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < mapping.cards.length; i++) {
    const entry = mapping.cards[i];
    const selectedMatch = entry.matches.find((m) => m.selected);

    if (!selectedMatch) {
      console.log(`[${String(i + 1).padStart(3, '0')}] #${entry.no} ${entry.name} - SKIPPED (no match)`);
      skipped++;
      continue;
    }

    const progress = `[${String(i + 1).padStart(3, '0')}/${mapping.cards.length}]`;
    process.stdout.write(`${progress} #${entry.no} ${entry.name} (${selectedMatch.tcgPlayerId}) ... `);

    try {
      const correction = CORRECTIONS[entry.no];
      // Use tcgPlayerId as query param (API returns 404 HTML for path param)
      let endpoint = `/cards?tcgPlayerId=${encodeURIComponent(selectedMatch.tcgPlayerId)}&includeEbay=true`;
      if (correction?.language) {
        endpoint += `&language=${correction.language}`;
      }

      const result: PPTSingleCardResponse = await pptFetch(endpoint, apiKey);
      const cardData = result.data;

      const grades = parseExpectedGrades(entry.expectedGrade);
      const allPrintings = entry.matches.map((m) => `${m.printing} (${m.setName})`).join('; ');
      const salesByGrade = cardData.ebay?.salesByGrade;

      for (const expectedGrade of grades) {
        const lowerGrade = expectedGrade > 1 ? expectedGrade - 1 : null;
        const upperGrade = expectedGrade < 10 ? expectedGrade + 1 : null;
        const expectedData = getGradeData(salesByGrade, expectedGrade);
        const lowerData = getGradeData(salesByGrade, lowerGrade);
        const upperData = getGradeData(salesByGrade, upperGrade);

        const rawNmPrice = extractNmPrice(cardData);
        let valueUplift: number | null = null;
        let netRoi: number | null = null;
        let roiPercent: number | null = null;

        if (rawNmPrice !== null && expectedData.average !== null) {
          valueUplift = expectedData.average - rawNmPrice;
          netRoi = valueUplift - GRADING_COST;
          roiPercent = ((netRoi) / (rawNmPrice + GRADING_COST)) * 100;
        }

        priceEntries.push({
          no: entry.no, name: entry.name, cardNumber: entry.cardNumber,
          set: selectedMatch.setName, printing: selectedMatch.printing,
          expectedGrade, justification: entry.justification,
          lower: lowerData, expected: expectedData, upper: upperData,
          rawNmPrice, gradingCost: GRADING_COST,
          valueUplift, netRoi, roiPercent,
          isSelectedVariant: true, allPrintingsFound: allPrintings,
          tcgPlayerId: selectedMatch.tcgPlayerId,
        });
      }

      fetched++;
      const gradeStr = grades.length > 1 ? `grades ${grades.join(',')}` : `grade ${grades[0]}`;
      const ebayGrades = salesByGrade ? Object.keys(cardData.ebay?.salesByGrade || {}).join(',') : 'none';
      console.log(`OK (${gradeStr}) ebay:[${ebayGrades}]`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`ERROR: ${msg}`);
      errors++;

      const grades = parseExpectedGrades(entry.expectedGrade);
      for (const expectedGrade of grades) {
        priceEntries.push({
          no: entry.no, name: entry.name, cardNumber: entry.cardNumber,
          set: selectedMatch.setName, printing: selectedMatch.printing,
          expectedGrade, justification: entry.justification,
          lower: { grade: expectedGrade > 1 ? expectedGrade - 1 : null, average: null, median: null, count: 0, confidence: 'N/A' },
          expected: { grade: expectedGrade, average: null, median: null, count: 0, confidence: 'N/A' },
          upper: { grade: expectedGrade < 10 ? expectedGrade + 1 : null, average: null, median: null, count: 0, confidence: 'N/A' },
          rawNmPrice: null, gradingCost: GRADING_COST,
          valueUplift: null, netRoi: null, roiPercent: null,
          isSelectedVariant: true, allPrintingsFound: '',
          tcgPlayerId: selectedMatch.tcgPlayerId,
        });
      }
    }

    await sleep(RATE_LIMIT_MS);
  }

  // Write prices.json
  const pricesFile: PricesFile = {
    generatedAt: new Date().toISOString(),
    gradingCostPerCard: GRADING_COST,
    totalCards: priceEntries.length,
    entries: priceEntries,
  };
  const pricesJsonPath = path.join(OUTPUT_DIR, 'prices.json');
  fs.writeFileSync(pricesJsonPath, JSON.stringify(pricesFile, null, 2));
  console.log(`\nWritten ${pricesJsonPath}`);

  // Write prices.csv
  const csvHeader = [
    'No', 'Card', 'CardNumber', 'Set', 'Printing', 'ExpectedGrade', 'Justification',
    'PSA_Lower_Grade', 'PSA_Lower_Avg', 'PSA_Lower_Med', 'PSA_Lower_Count', 'PSA_Lower_Confidence',
    'PSA_Expected_Grade', 'PSA_Expected_Avg', 'PSA_Expected_Med', 'PSA_Expected_Count', 'PSA_Expected_Confidence',
    'PSA_Upper_Grade', 'PSA_Upper_Avg', 'PSA_Upper_Med', 'PSA_Upper_Count', 'PSA_Upper_Confidence',
    'Raw_NM_Price', 'Grading_Cost', 'Value_Uplift', 'Net_ROI', 'ROI_Percent',
    'Is_Selected_Variant', 'All_Printings_Found',
  ].join(',');

  const csvRows: string[] = [csvHeader];
  for (const e of priceEntries) {
    csvRows.push(csvRow([
      e.no, e.name, e.cardNumber, e.set, e.printing, e.expectedGrade, e.justification,
      e.lower.grade ?? 'N/A', fmtPrice(e.lower.average), fmtPrice(e.lower.median), e.lower.count, e.lower.confidence,
      e.expected.grade ?? 'N/A', fmtPrice(e.expected.average), fmtPrice(e.expected.median), e.expected.count, e.expected.confidence,
      e.upper.grade ?? 'N/A', fmtPrice(e.upper.average), fmtPrice(e.upper.median), e.upper.count, e.upper.confidence,
      fmtPrice(e.rawNmPrice), e.gradingCost, fmtPrice(e.valueUplift), fmtPrice(e.netRoi),
      e.roiPercent !== null ? e.roiPercent.toFixed(1) : '',
      e.isSelectedVariant ? 'Y' : 'N', e.allPrintingsFound,
    ]));
  }
  const pricesCsvPath = path.join(OUTPUT_DIR, 'prices.csv');
  fs.writeFileSync(pricesCsvPath, csvRows.join('\n'));
  console.log(`Written ${pricesCsvPath}`);

  // Summary
  const withPrices = priceEntries.filter((e) => e.expected.average !== null);
  const positiveRoi = priceEntries.filter((e) => e.netRoi !== null && e.netRoi > 0);
  const totalRoi = priceEntries.reduce((sum, e) => sum + (e.netRoi ?? 0), 0);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Results: ${fetched} fetched, ${skipped} skipped, ${errors} errors`);
  console.log(`  Price rows: ${priceEntries.length} (${withPrices.length} with eBay data)`);
  console.log(`  Positive ROI: ${positiveRoi.length}/${priceEntries.length} cards`);
  console.log(`  Total estimated Net ROI: $${totalRoi.toFixed(2)}`);
  console.log('═══════════════════════════════════════════════════════════');
}

// ─── Utility Functions ───────────────────────────────────────────────────────

function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map((v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }).join(',');
}

function fmtPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toFixed(2);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const phase = args.find((a) => a === 'phase1' || a === 'phase2');
  const keyArg = args.find((a) => a.startsWith('--key='));
  const apiKey = keyArg ? keyArg.split('=')[1] : process.env.PPT_API_KEY;

  if (!phase) {
    console.log('Usage: npx tsx scripts/psa-price-fetch.ts [phase1|phase2] [--key=API_KEY]');
    console.log('');
    console.log('  phase1  Search PPT API, match cards, output mapping files');
    console.log('  phase2  Fetch prices for matched cards, calculate ROI');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('ERROR: No API key. Set PPT_API_KEY env var or pass --key=YOUR_KEY');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  if (phase === 'phase1') {
    await runPhase1(apiKey);
  } else {
    await runPhase2(apiKey);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
