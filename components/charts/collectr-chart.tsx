'use client';

import * as React from 'react';
import {
  LineChart,
  Line,
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

  const hasRaw = gradeInfos.some(g => g.grade === 'raw');
  const gradedList = gradeInfos.filter(g => g.grade !== 'raw');
  const hasGraded = true; // Graded tab is now permanently accessible, matching Collectr app behavior

  const [activeTab, setActiveTab] = React.useState<ChartType>('RAW');
  
  const defaultGrade = gradedList.find(g => g.grade === '10')?.grade 
    || gradedList.find(g => g.grade === '9')?.grade 
    || gradedList[0]?.grade 
    || 'raw';

  const [activeGrade, setActiveGrade] = React.useState<string>(defaultGrade);
  const [timeRange, setTimeRange] = React.useState<TimeRange>('1W');

  // When tab changes, ensure correct active grade
  React.useEffect(() => {
    if (activeTab === 'RAW') {
      setActiveGrade('raw');
    } else if (activeTab === 'GRADED') {
      const bestGraded = gradedList.find(g => g.grade === '10')?.grade 
        || gradedList.find(g => g.grade === '9')?.grade 
        || gradedList[0]?.grade;
      if (bestGraded) setActiveGrade(bestGraded);
    }
  }, [activeTab]);

  const filteredByGrade = React.useMemo(() => {
    return priceHistory.filter(h => h.grade === activeGrade || h.grade === `psa${activeGrade}` || h.grade === `psa-${activeGrade}`);
  }, [priceHistory, activeGrade]);

  const { chartData, activeSources, minPrice, maxPrice } = React.useMemo(() => {
    const now = new Date();
    const ranges: Record<TimeRange, number> = {
      '1W': 7,
      '1M': 30,
      '3M': 90,
    };

    const daysAgo = ranges[timeRange];
    const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const relevantHistory = filteredByGrade.filter(point => {
      return new Date(point.recorded_at) >= cutoff;
    });

    const chartDataMap = new Map<string, Record<string, string | number>>();
    let min = Infinity;
    let max = -Infinity;
    const activeSourcesSet = new Set<string>();

    relevantHistory.forEach(h => {
      // Use exact timestamp to allow multiple intra-day data points to be drawn
      const date = h.recorded_at; 
      const source = (h.source || 'yuyutei').toLowerCase();
      
      activeSourcesSet.add(source);

      if (!chartDataMap.has(date)) {
        chartDataMap.set(date, { date });
      }
      const entry = chartDataMap.get(date)!;
      entry[source] = h.price;
      
      if (h.price < min) min = h.price;
      if (h.price > max) max = h.price;
    });

    const initialData = Array.from(chartDataMap.values()).map(entry => {
        return {
            ...entry,
            dateDisplay: entry.date
        };
    }).sort((a, b) => new Date(a.dateDisplay as string).getTime() - new Date(b.dateDisplay as string).getTime());

    // Forward-fill algorithm
    const activeSourcesArr = Array.from(activeSourcesSet);
    const lastKnownPrices: Record<string, number> = {};
    
    const finalData = initialData.map(row => {
        const newRow = { ...row };
        activeSourcesArr.forEach(source => {
            if (row[source] !== undefined) {
                lastKnownPrices[source] = row[source] as number;
            } else if (lastKnownPrices[source] !== undefined) {
                newRow[source] = lastKnownPrices[source];
            }
        });
        return newRow;
    });

    return {
      chartData: finalData,
      activeSources: Array.from(activeSourcesSet),
      minPrice: min === Infinity ? 0 : min,
      maxPrice: max === -Infinity ? 100 : max,
    };
  }, [filteredByGrade, timeRange]);

  // Group gradedList by grading company
  const gradedByCompany = React.useMemo(() => {
    const groups: Record<string, GradeInfo[]> = {};
    gradedList.forEach(g => {
        const comp = (g.grading_company || 'Unknown').toUpperCase();
        if (!groups[comp]) groups[comp] = [];
        groups[comp].push(g);
    });
    // Sort grades descending within company
    for (const comp in groups) {
        groups[comp].sort((a, b) => {
            const numA = parseFloat(a.grade) || 0;
            const numB = parseFloat(b.grade) || 0;
            return numB - numA; // 10, 9, 8.5
        });
    }
    return groups;
  }, [gradedList]);

  return (
    <div className={cn('flex flex-col space-y-4 rounded-3xl bg-[#0b1329]/80 backdrop-blur-sm border border-white/10 text-white p-5 shadow-2xl relative overflow-hidden', className)}>
      
      {/* Top Header Row */}
      <div className="relative z-10 flex items-center justify-between w-full">
        {/* Time Range Toggles (Moved to Top Left) */}
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

      {/* Dynamic Legend */}
      {activeSources.length > 0 && (
          <div className="relative z-10 flex items-center flex-wrap gap-4 mt-2 px-1">
              {activeSources.map(source => (
                  <div key={source} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: SOURCE_COLORS[source] || SOURCE_COLORS.default }} />
                      <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">{source}</span>
                  </div>
              ))}
          </div>
      )}

      {/* The Chart */}
      <div className="relative z-10 h-[240px] w-full mt-2 -ml-2">
        {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <LineChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
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
                            {payload.map(item => (
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
            </LineChart>
            </ResponsiveContainer>
        ) : (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-zinc-600 font-medium text-sm">Not enough chart data for this period.</p>
            </div>
        )}
      </div>

      {/* Original Time Range Toggles Removed */}

      {/* Graded Swipe Box */}
      {activeTab === 'GRADED' && hasGraded && (
          <div className="mt-4 border-t border-[#222222] pt-4 overflow-hidden">
            <div className="flex overflow-x-auto gap-4 no-scrollbar pb-1">
              {Object.entries(gradedByCompany).map(([company, grades]) => (
                  <div key={company} className="flex flex-col min-w-max">
                      <h3 className="text-[13px] font-bold text-white mb-2 ml-1">{company}</h3>
                      <div className="flex gap-[1px] bg-[#222] p-[1px] rounded-lg border border-[#333]">
                          {grades.map(g => {
                              const isSelected = activeGrade === g.grade;
                              return (
                                  <button
                                      key={g.grade}
                                      onClick={() => setActiveGrade(g.grade)}
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
          </div>
      )}

    </div>
  );
}
