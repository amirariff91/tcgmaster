/**
 * OHLC Data Generation Utilities
 * For generating realistic mock price history data
 */

export interface OHLCData {
  time: string; // ISO date string YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface PriceDataPoint {
  date: string;
  price: number;
}

interface GenerateOHLCOptions {
  startDate: Date;
  endDate: Date;
  startPrice: number;
  volatility?: number; // Daily percentage volatility (0.01 = 1%)
  trend?: number; // Daily trend bias (-0.005 to 0.005 typical)
  spikeChance?: number; // Probability of a price spike (0-1)
  spikeMultiplier?: number; // How big spikes are
}

/**
 * Generate daily OHLC data for a date range
 */
export function generateDailyOHLC({
  startDate,
  endDate,
  startPrice,
  volatility = 0.02, // 2% daily volatility
  trend = 0.001, // 0.1% daily upward bias
  spikeChance = 0.05, // 5% chance of spike
  spikeMultiplier = 3, // Spikes are 3x normal moves
}: GenerateOHLCOptions): OHLCData[] {
  const data: OHLCData[] = [];
  let currentPrice = startPrice;
  const current = new Date(startDate);

  while (current <= endDate) {
    // Skip weekends (optional, comment out for daily)
    // const dayOfWeek = current.getDay();
    // if (dayOfWeek === 0 || dayOfWeek === 6) {
    //   current.setDate(current.getDate() + 1);
    //   continue;
    // }

    // Determine if this is a spike day
    const isSpike = Math.random() < spikeChance;
    const dayVolatility = isSpike ? volatility * spikeMultiplier : volatility;

    // Random walk with drift
    const dailyReturn = (Math.random() - 0.5) * 2 * dayVolatility + trend;
    const newPrice = currentPrice * (1 + dailyReturn);

    // Generate OHLC from daily movement
    const open = currentPrice;
    const close = newPrice;

    // High/low with some intraday noise
    const intradayNoise = volatility * 0.5;
    const high = Math.max(open, close) * (1 + Math.random() * intradayNoise);
    const low = Math.min(open, close) * (1 - Math.random() * intradayNoise);

    // Generate volume (correlated with price movement)
    const priceChange = Math.abs(close - open) / open;
    const baseVolume = 100 + Math.random() * 50;
    const volume = Math.round(baseVolume * (1 + priceChange * 10));

    data.push({
      time: current.toISOString().split('T')[0],
      open: Math.max(0.01, Math.round(open * 100) / 100),
      high: Math.max(0.01, Math.round(high * 100) / 100),
      low: Math.max(0.01, Math.round(low * 100) / 100),
      close: Math.max(0.01, Math.round(close * 100) / 100),
      volume,
    });

    currentPrice = newPrice;
    current.setDate(current.getDate() + 1);
  }

  return data;
}

/**
 * Generate weekly OHLC data from daily data
 */
export function aggregateToWeekly(dailyData: OHLCData[]): OHLCData[] {
  const weeklyData: OHLCData[] = [];
  let weekStart = 0;

  for (let i = 0; i < dailyData.length; i++) {
    const current = new Date(dailyData[i].time);
    const dayOfWeek = current.getDay();

    // Start of new week (Sunday = 0 or Monday = 1)
    if (i === 0 || dayOfWeek === 0) {
      weekStart = i;
    }

    // End of week (Saturday or last day)
    if (dayOfWeek === 6 || i === dailyData.length - 1) {
      const weekDays = dailyData.slice(weekStart, i + 1);
      if (weekDays.length > 0) {
        weeklyData.push({
          time: weekDays[0].time, // Week start date
          open: weekDays[0].open,
          high: Math.max(...weekDays.map((d) => d.high)),
          low: Math.min(...weekDays.map((d) => d.low)),
          close: weekDays[weekDays.length - 1].close,
          volume: weekDays.reduce((sum, d) => sum + (d.volume || 0), 0),
        });
      }
    }
  }

  return weeklyData;
}

/**
 * Convert simple price array to OHLC format
 * Useful for displaying line chart data as candlesticks
 */
export function priceArrayToOHLC(prices: PriceDataPoint[]): OHLCData[] {
  return prices.map((p, i) => {
    const prevPrice = i > 0 ? prices[i - 1].price : p.price;
    const open = prevPrice;
    const close = p.price;
    const variation = Math.abs(close - open) * 0.2;

    return {
      time: p.date,
      open,
      high: Math.max(open, close) + variation,
      low: Math.min(open, close) - variation,
      close,
    };
  });
}

/**
 * Generate mock OHLC history for a card
 * Creates 90 days of daily data + 2 years of weekly data
 */
export function generateMockCardHistory(currentPrice: number): {
  daily: OHLCData[];
  weekly: OHLCData[];
} {
  const now = new Date();

  // Generate 2 years + 90 days of daily data starting from 2 years ago
  const startDate = new Date(now);
  startDate.setFullYear(startDate.getFullYear() - 2);

  // Work backwards from current price to estimate historical price
  // Assume average 5% annual growth with high volatility
  const annualGrowth = 0.05;
  const yearsBack = 2 + 90 / 365;
  const historicalPrice = currentPrice / Math.pow(1 + annualGrowth, yearsBack);

  // Generate all daily data
  const allDaily = generateDailyOHLC({
    startDate,
    endDate: now,
    startPrice: historicalPrice,
    volatility: 0.03, // 3% daily volatility (TCG cards are volatile)
    trend: annualGrowth / 365, // Daily trend from annual growth
    spikeChance: 0.02, // 2% spike chance
    spikeMultiplier: 2.5,
  });

  // Split into recent daily (90 days) and older weekly
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const olderDaily = allDaily.filter((d) => d.time < cutoffStr);
  const recentDaily = allDaily.filter((d) => d.time >= cutoffStr);

  // Aggregate older data to weekly
  const weekly = aggregateToWeekly(olderDaily);

  return {
    daily: recentDaily,
    weekly,
  };
}

/**
 * Merge weekly and daily OHLC data for display
 * Returns appropriate granularity based on time range
 */
export function getOHLCForTimeRange(
  daily: OHLCData[],
  weekly: OHLCData[],
  days: number
): OHLCData[] {
  if (days <= 90) {
    // Use daily data for short ranges
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return daily.filter((d) => new Date(d.time) >= cutoff);
  }

  if (days <= 365) {
    // Use weekly for medium ranges, but include recent daily
    const weekCutoff = new Date();
    weekCutoff.setDate(weekCutoff.getDate() - days);
    const recentWeekly = weekly.filter((d) => new Date(d.time) >= weekCutoff);
    return [...recentWeekly, ...daily];
  }

  // Use all weekly + recent daily for long ranges
  return [...weekly, ...daily];
}
