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
}

export interface CollectrChartProps {
  priceHistory: PriceHistoryPoint[];
  gradeInfos: GradeInfo[];
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

export function CollectrChart({ priceHistory, gradeInfos, className }: CollectrChartProps) {
  const { format } = useCurrencyContext();

  const hasRaw = priceHistory.some(h => h.grade === 'raw');
  const gradedList = gradeInfos.filter(g => g.grade !== 'raw');
  const hasGraded = priceHistory.some(h => h.grade !== 'raw');

  const [activeTab, setActiveTab] = React.useState<ChartType>(hasRaw ? 'RAW' : (hasGraded ? 'GRADED' : 'RAW'));
  
  const defaultGradeInfo = gradedList.find(g => g.grade === '10' && g.grading_company === 'psa')
    || gradedList.find(g => g.grade === '9' && g.grading_company === 'psa')
    || gradedList.find(g => g.grade === '10')
    || gradedList[0];

  const [activeGrade, setActiveGrade] = React.useState<string>(defaultGradeInfo?.grade || 'none');
  const [activeCompany, setActiveCompany] = React.useState<string | null>(defaultGradeInfo?.grading_company || null);
  const [timeRange, setTimeRange] = React.useState<TimeRange>('1W');

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
        const bestHistory = historyGraded.find(h => h.grade === '10') || historyGraded[0];
        if (bestHistory) {
           bestInfo = { grade: bestHistory.grade, grading_company: bestHistory.grading_company_id || 'psa', price: 0, population: null };
        }
      }
      
      setActiveGrade(bestInfo?.grade || 'none');
      setActiveCompany(bestInfo?.grading_company || null);
    }
  }, [activeTab]);

  const filteredByGrade = React.useMemo(() => {
    if (activeGrade === 'raw') return priceHistory.filter(h => h.grade === 'raw');
    
    return priceHistory.filter(h => {
       const hCompany = h.grading_company_id || 'psa';
       const matchGrade = h.grade === activeGrade;
       const matchCompany = hCompany.toLowerCase() === (activeCompany || 'psa').toLowerCase();
       return matchGrade && matchCompany;
    });
  }, [priceHistory, activeGrade, activeCompany]);

  const { chartData, activeSources, minPrice, maxPrice } = React.useMemo(() => {
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

    const chartDataArr: any[] = [];

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
      const entry: any = { dateDisplay: dateStr };
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

    return {
      chartData: chartDataArr,
      activeSources: activeSourcesArr,
      minPrice: min === Infinity ? 0 : min,
      maxPrice: max === -Infinity ? 100 : max
    };
  }, [filteredByGrade, timeRange]);

  return (
    <div className={cn('relative w-full rounded-2xl bg-[#141414] border border-[#222222] p-4 text-white overflow-hidden shadow-2xl', className)}>
      
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
                      <div className="flex gap-[1px] bg-[#222] p-[1px] rounded-lg border border-[#333]">
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
                                          "w-[76px] h-[76px] flex flex-col items-center justify-center transition-all",
                                          isSelected ? "bg-[#2dd4bf]/20 text-[#2dd4bf] shadow-inner" : "bg-transparent text-zinc-400 hover:bg-white/5"
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
  );
}
