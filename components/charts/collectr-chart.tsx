'use client';

import * as React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { cn, formatDate } from '@/lib/utils';
import { useCurrencyContext } from '@/lib/currency-context';
import { ExternalLink } from 'lucide-react';
import { FormattedPrice } from '@/components/ui/formatted-price';
import { priceKindLabel, type PriceKind } from '@/lib/pricing/price-labels';

export interface PriceHistoryPoint {
  grade: string;
  price: number;
  recorded_at: string;
  source?: string;
  grading_company_id?: string | null;
}

export interface GradeInfo {
  grade: string;
  grading_company: string | null;
  price: number;
  population: number | null;
  sources?: Record<string, number | null>;
}

export interface CollectrChartProps {
  priceHistory: PriceHistoryPoint[];
  gradeInfos: GradeInfo[];
  marketUrls?: Record<string, string>;
  className?: string;
}

type TimeRange = '1W' | '1M' | '3M';
type ChartType = 'RAW' | 'GRADED';

const SOURCE_COLORS: Record<string, string> = {
  yuyutei: '#2dd4bf', // Teal
  tcgplayer: '#10b981', // Green
  snkrdunk: '#3b82f6', // Blue
  cardrush: '#a855f7', // Purple
  ebay: '#f59e0b', // Orange
  pricecharting: '#ef4444', // Red
  default: '#a1a1aa' // Gray
};

const MARKET_LOGOS = [
  { match: 'snkrdunk', logo: '/logos/snkrdunk.png' },
  { match: 'yuyutei', logo: '/logos/yuyutei.png' },
  { match: 'cardrush', logo: '/logos/cardrush.png' },
  { match: 'tcgplayer', logo: '/logos/tcgplayer.png' },
  { match: 'pricecharting', logo: '/logos/pricecharting.png' },
  { match: 'tcgrepublic', logo: '/logos/tcgrepublic.png' },
  { match: 'tcg republic', logo: '/logos/tcgrepublic.png' },
] as const;

const SOURCE_KIND: Record<string, PriceKind> = {
  tcgplayer: 'market',
  pricecharting: 'sold_guide',
  yuyutei: 'retail_sell',
  cardrush: 'lowest_listing',
  snkrdunk: 'marketplace_ask',
};

export function CollectrChart({ priceHistory, gradeInfos, marketUrls = {}, className }: CollectrChartProps) {
  const { format } = useCurrencyContext();

  const hasRaw = priceHistory.some(h => h.grade === 'raw');
  const gradedList = gradeInfos.filter(g => g.grade !== 'raw');
  const hasGraded = gradeInfos.some(g => g.grade !== 'raw' && g.price > 0);

  const [activeTab, setActiveTab] = React.useState<ChartType>(hasRaw ? 'RAW' : (hasGraded ? 'GRADED' : 'RAW'));

  const defaultGradeInfo = gradedList.find(g => g.grade === '10' && g.grading_company === 'psa')
    || gradedList.find(g => g.grade === '9' && g.grading_company === 'psa')
    || gradedList.find(g => g.grade === '10')
    || gradedList[0];

  const [activeGrade, setActiveGrade] = React.useState<string>(defaultGradeInfo?.grade || 'none');
  const [activeCompany, setActiveCompany] = React.useState<string | null>(defaultGradeInfo?.grading_company || null);
  const [timeRange, setTimeRange] = React.useState<TimeRange>('3M');

  // Compute PSA 10 Gem Rate dynamically from population counts
  const gemRate = React.useMemo(() => {
    const psa10 = gradeInfos.find(g => g.grade === '10' || g.grade === 'psa10')?.population ?? null;
    const totalPop = gradeInfos
      .filter(g => g.grade !== 'raw' && g.population !== null)
      .reduce((sum, g) => sum + (g.population ?? 0), 0);
    if (psa10 !== null && totalPop > 0) {
      return (psa10 / totalPop) * 100;
    }
    return null;
  }, [gradeInfos]);

  // Group graded items by company (PSA, BGS, CGC)
  const gradedByCompany = React.useMemo(() => {
    const groups: Record<string, GradeInfo[]> = {};
    gradedList.forEach(item => {
      // Use uppercase for display headers
      const company = (item.grading_company || 'PSA').toUpperCase();
      if (!groups[company]) groups[company] = [];
      groups[company].push(item);
    });
    return groups;
  }, [gradedList]);

  // When tab changes, ensure correct active grade
  React.useEffect(() => {
    if (activeTab === 'RAW') {
      setActiveGrade('raw');
      setActiveCompany(null);
    } else if (activeTab === 'GRADED') {
      let bestInfo = gradedList.find(g => g.grade === '10' && g.grading_company === 'psa')
        || gradedList.find(g => g.grade === '9' && g.grading_company === 'psa')
        || gradedList.find(g => g.grade === '10')
        || gradedList[0];

      if (!bestInfo) {
        const historyGraded = priceHistory.filter(h => h.grade !== 'raw');
        const bestHistory = historyGraded.find(h => h.grade === '10' || h.grade?.replace(/^[a-zA-Z]+-?/, '') === '10') || historyGraded[0];
        if (bestHistory) {
           bestInfo = { grade: bestHistory.grade?.replace(/^[a-zA-Z]+-?/, ''), grading_company: bestHistory.grading_company_id || 'psa', price: 0, population: null };
        }
      }

      setActiveGrade(bestInfo?.grade || 'none');
      setActiveCompany(bestInfo?.grading_company || null);
    }
  }, [activeTab]);

  const filteredByGrade = React.useMemo(() => {
    if (activeGrade === 'raw') return priceHistory.filter(h => h.grade === 'raw');

    let filtered = priceHistory.filter(h => {
       const hCompany = h.grading_company_id || 'psa';
       const normalizedDbGrade = h.grade?.replace(/^[a-zA-Z]+-?/, '') || '';
       const matchGrade = h.grade === activeGrade || normalizedDbGrade === activeGrade;
       const matchCompany = hCompany.toLowerCase() === (activeCompany || 'psa').toLowerCase();
       return matchGrade && matchCompany;
    });

    if (filtered.length === 0) {
      const info = gradeInfos?.find(g => g.grade === activeGrade && (g.grading_company || 'psa').toLowerCase() === (activeCompany || 'psa').toLowerCase());
      if (info?.sources) {
        const sources = Object.entries(info.sources).flatMap(([source, price]) => (
          typeof price === 'number' ? [{ source, price }] : []
        ));
        const now = new Date().toISOString();
        filtered = sources.map(({ source, price }) => ({
          grade: activeGrade,
          grading_company_id: activeCompany || 'psa',
          price: price,
          source: source,
          recorded_at: now,
        }));
      }
    }

    return filtered;
  }, [priceHistory, activeGrade, activeCompany, gradeInfos]);

  const { chartData, activeSources, minPrice, maxPrice, latestPricesList } = React.useMemo(() => {
    const now = new Date();
    const ranges: Record<TimeRange, number> = {
      '1W': 7,
      '1M': 30,
      '3M': 90,
    };

    const daysAgo = ranges[timeRange];
    const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Identify all unique sources that have data in this grade
    const activeSourcesSet = new Set<string>();
    filteredByGrade.forEach(p => activeSourcesSet.add(p.source || 'default'));
    const activeSourcesArr = Array.from(activeSourcesSet);

    // Sort all history chronologically
    const sortedHistory = [...filteredByGrade].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

    // Find the baseline price for each source right before the cutoff date
    const lastKnownPrices: Record<string, number> = {};

    // Pre-seed lastKnownPrices with the absolute latest known price per source
    activeSourcesArr.forEach(src => {
      const latestForSrc = sortedHistory.slice().reverse().find(p => (p.source || 'default') === src);
      if (latestForSrc) lastKnownPrices[src] = latestForSrc.price;
    });

    // Override with the last point before cutoff (for accurate at-the-boundary seeding)
    sortedHistory.forEach(point => {
      if (new Date(point.recorded_at) < cutoff) {
        lastKnownPrices[point.source || 'default'] = point.price;
      }
    });

    let min = Infinity;
    let max = -Infinity;

    // Group all history points by day so we can apply them during our day-by-day iteration
    const historyByDay: Record<string, Record<string, number>> = {};
    sortedHistory.forEach(point => {
      const dateStr = point.recorded_at.split('T')[0];
      if (!historyByDay[dateStr]) historyByDay[dateStr] = {};
      historyByDay[dateStr][point.source || 'default'] = point.price;
    });

    type ChartDatum = {
      dateDisplay: string;
      price?: number;
      [source: string]: string | number | undefined;
    };
    const chartDataArr: ChartDatum[] = [];

    // Iterate day by day from cutoff to today
    for (let i = 0; i <= daysAgo; i++) {
      const currentDate = new Date(cutoff.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = currentDate.toISOString().split('T')[0];

      // Update lastKnownPrices if there are new historical data points on this exact day
      if (historyByDay[dateStr]) {
        for (const [src, price] of Object.entries(historyByDay[dateStr])) {
          lastKnownPrices[src] = price;
        }
      }

      // Create the entry for this day using the forward-filled lastKnownPrices
      const entry: ChartDatum = { dateDisplay: dateStr };
      let sum = 0;
      let count = 0;

      for (const src of activeSourcesArr) {
        if (lastKnownPrices[src] !== undefined) {
          const p = lastKnownPrices[src];
          entry[src] = p;
          sum += p;
          count++;
          if (p < min) min = p;
          if (p > max) max = p;
        }
      }

      // Only set average price if we have data, otherwise leave undefined so Recharts doesn't drop to 0
      if (count > 0) {
        entry.price = sum / count;
      }

      chartDataArr.push(entry);
    }

    // Build the dynamic "Compared Sources" list based on the exact data currently shown on the chart.
    const latestPricesList = activeSourcesArr.map(source => {
      // Find the most recent history point for this source
      const latestPoint = sortedHistory.slice().reverse().find(p => p.source === source);
      return {
        source,
        price: latestPoint?.price || lastKnownPrices[source] || 0,
        date: latestPoint?.recorded_at || cutoff.toISOString(),
        kind: SOURCE_KIND[source] || 'market',
      };
    }).sort((a, b) => a.price - b.price);

    return { chartData: chartDataArr, activeSources: activeSourcesArr, minPrice: min === Infinity ? 0 : min, maxPrice: max === -Infinity ? 100 : max, latestPricesList };
  }, [filteredByGrade, timeRange]);


  return (
    <div className={cn("flex flex-col space-y-6 w-full", className)}>
    <div className="relative w-full rounded-2xl bg-[#141414] border border-[#222222] p-4 text-white overflow-hidden shadow-2xl">

      {/* Top Header Row */}
      <div className="relative z-10 flex items-center justify-between w-full">
        {/* Time Range Toggles (Top Left) */}
        <div className="flex bg-[#222222] rounded-full p-1 border border-white/5">
          {(['1W', '1M', '3M'] as TimeRange[]).map((tr) => {
              const isActive = timeRange === tr;
              return (
                  <button
                      key={tr}
                      onClick={() => setTimeRange(tr)}
                      className={cn(
                          "py-1.5 px-3 text-[11px] font-bold rounded-full transition-colors uppercase tracking-wider",
                          isActive ? "bg-[#3f3f46] text-white" : "text-gray-400 hover:text-white"
                      )}
                  >
                      {tr}
                  </button>
              );
          })}
        </div>

        {/* Top Pill Selector */}
        <div className="flex bg-[#222222] rounded-full p-1 border border-white/5 w-[140px]">
          <button
              onClick={() => setActiveTab('RAW')}
              disabled={!hasRaw}
              className={cn("flex-1 py-1.5 text-[11px] font-bold rounded-full transition-colors uppercase tracking-wider",
                  activeTab === 'RAW' ? "bg-[#3f3f46] text-white" : "text-gray-400 hover:text-white",
                  !hasRaw && "opacity-30 cursor-not-allowed")}
          >
              Raw
          </button>
          <button
              onClick={() => { setActiveTab('GRADED'); }}
              className={cn("flex-1 py-1.5 text-[11px] font-bold rounded-full transition-colors uppercase tracking-wider",
                  activeTab === 'GRADED' ? "bg-[#3f3f46] text-white" : "text-gray-400 hover:text-white")}
          >
              Graded
          </button>
        </div>
      </div>

      {/* Dynamic Multi-Source Color Legend */}
      {activeSources.length > 0 && (
          <div className="relative z-10 flex items-center flex-wrap gap-4 mt-3 px-1">
              {activeSources.map(source => (
                  <div key={source} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: SOURCE_COLORS[source] || SOURCE_COLORS.default }} />
                      <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">{source}</span>
                  </div>
              ))}
          </div>
      )}

      {/* The Multi-Line Chart */}
      <div className="relative z-10 h-[240px] w-full mt-2 -ml-2">
        {chartData.length >= 2 && chartData.some(d => d.price !== undefined) ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <ComposedChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorTeal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <XAxis
                    dataKey="dateDisplay"
                    tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US', { month: 'short' });
                    }}
                    stroke="#52525b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                    dy={10}
                />
                <YAxis hide domain={['auto', 'auto']} />

                {/* Dotted lines for Max/Min */}
                <ReferenceLine y={maxPrice} stroke="#52525b" strokeDasharray="3 3" />
                <ReferenceLine y={minPrice} stroke="#52525b" strokeDasharray="3 3" />

                {/* Max/Min Labels */}
                <text x="10" y="10" fill="#a1a1aa" fontSize="11" fontWeight="500">{format(maxPrice)}</text>
                <text x="10" y="210" fill="#a1a1aa" fontSize="11" fontWeight="500">{format(minPrice)}</text>

                <Tooltip
                    content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                        <div className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-3 shadow-xl min-w-[120px]">
                            <p className="mb-2 text-xs text-zinc-400 border-b border-zinc-700 pb-1">{label ? formatDate(String(label)) : ''}</p>
                            {payload.filter(item => item.dataKey !== 'price').map(item => (
                                <div key={item.dataKey} className="flex justify-between items-center gap-4 mb-1 last:mb-0">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs text-zinc-300 capitalize">{item.dataKey}</span>
                                    </div>
                                    <span className="font-bold text-white tabular-nums text-sm">
                                        {(item.value as number) > 0 ? format(item.value as number) : '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                        );
                    }}
                />

                <Area
                    type="monotone"
                    dataKey="price"
                    stroke="none"
                    fillOpacity={1}
                    fill="url(#colorTeal)"
                    isAnimationActive={false}
                />

                {activeSources.map(source => (
                    <Line
                        key={source}
                        type="monotone"
                        dataKey={source}
                        stroke={SOURCE_COLORS[source] || SOURCE_COLORS.default}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: SOURCE_COLORS[source] || SOURCE_COLORS.default, stroke: '#fff', strokeWidth: 1 }}
                        isAnimationActive={false}
                        connectNulls
                    />
                ))}
            </ComposedChart>
            </ResponsiveContainer>
        ) : (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-zinc-600 font-medium text-sm">Not enough chart data for this period.</p>
            </div>
        )}
      </div>

      {/* Graded Swipe Box */}
      {activeTab === 'GRADED' && hasGraded && (
          <div className="mt-4 border-t border-[#222222] pt-4 overflow-hidden">
            <div className="flex overflow-x-auto gap-4 no-scrollbar pb-1">
              {Object.entries(gradedByCompany).map(([company, grades]) => (
                  <div key={company} className="flex flex-col min-w-max">
                      <h3 className="text-[13px] font-bold text-white mb-2 ml-1">{company}</h3>
                      <div className="flex gap-[1px] bg-[#0b1329]/80 border border-white/10 p-1 rounded-2xl backdrop-blur-sm">
                          {grades.map(g => {
                              const isSelected = activeGrade === g.grade && (activeCompany || 'PSA').toUpperCase() === company.toUpperCase();
                              return (
                                  <button
                                      key={`${company}-${g.grade}`}
                                      onClick={() => {
                                          setActiveGrade(g.grade);
                                          setActiveCompany(company.toLowerCase());
                                      }}
                                      className={cn(
                                          "w-[76px] h-[76px] flex flex-col items-center justify-center transition-all rounded-xl",
                                          isSelected ? "bg-[#2dd4bf]/25 text-[#2dd4bf] shadow-[0_0_12px_rgba(45,212,191,0.2)]" : "bg-transparent text-zinc-400 hover:bg-white/5"
                                      )}
                                  >
                                      <span className="text-[15px] font-bold mb-1">{g.grade}</span>
                                      <span className="text-[12px] font-medium tracking-tight mb-0.5">{g.price > 0 ? format(g.price) : '—'}</span>
                                      <span className="text-[11px] text-gray-500 font-medium">{g.population ?? '--'}</span>
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              ))}
            </div>
            {/* Real PSA 10 Gem Rate Indicator */}
            {gemRate !== null && (
              <div className="mt-3 flex items-center justify-center text-xs text-[#2dd4bf]">
                  <span className="mr-1">💎</span> Gem rate: {gemRate.toFixed(1)}% graded PSA 10
              </div>
            )}
          </div>
      )}

    </div>

    {/* Compared Sources */}
    {latestPricesList.length > 0 && (
      <div className="bg-[#0b1329]/80 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden shadow-sm">
        <div className="bg-white/5 px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            Compared Sources
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-extrabold tracking-widest",
              activeTab === 'RAW' ? "bg-zinc-800 text-zinc-300" : "bg-[#2dd4bf]/20 text-[#2dd4bf]"
            )}>
              {activeTab === 'RAW' ? 'RAW' : `${(activeCompany || 'PSA').toUpperCase()} ${activeGrade}`}
            </span>
          </h3>
        </div>
        <div className="divide-y divide-white/10">
          {latestPricesList.map((item) => {
            const s = item.source.toLowerCase();
            const logo = MARKET_LOGOS.find(m => s.includes(m.match))?.logo ?? null;
            const needsWhitePlate = !s.includes('snkrdunk');
            const href = marketUrls[item.source] ?? null;

            const body = (
              <>
                <div className="flex items-center gap-3">
                  {logo ? (
                    <img
                      src={logo}
                      alt={item.source}
                      className={`w-8 h-8 rounded-md border border-white/10 shadow-sm ${
                        needsWhitePlate
                          ? 'bg-white object-contain p-1'
                          : 'bg-white/5 object-cover p-0 overflow-hidden'
                      }`}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-md border border-white/10 shadow-sm bg-white/5 flex items-center justify-center text-zinc-400">
                      <span className="text-xs font-bold">{item.source.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <span className="text-white font-bold capitalize">{item.source}</span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{priceKindLabel(item.kind)}</span>
                  {href && <ExternalLink className="h-3.5 w-3.5 text-zinc-500" aria-hidden />}
                </div>
                <div className="text-right flex flex-col items-end">
                  <FormattedPrice price={item.price} className="text-orange-400 font-bold text-lg tabular-nums leading-none" />
                  <span className="text-[10px] text-zinc-500 mt-1 font-medium uppercase tracking-wider">{formatDate(item.date)}</span>
                </div>
              </>
            );

            const rowClass = 'flex justify-between items-center px-5 py-4 hover:bg-white/5 transition-colors';

            return href ? (
              <a
                key={item.source}
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                className={rowClass}
              >
                {body}
              </a>
            ) : (
              <div key={item.source} className={rowClass}>{body}</div>
            );
          })}
        </div>
      </div>
    )}

    </div>
  );
}
