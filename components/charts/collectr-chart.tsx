'use client';

import * as React from 'react';
import {
  AreaChart,
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

type TimeRange = '1M' | '3M' | '6M' | '12M' | 'MAX';
type ChartType = 'RAW' | 'GRADED';

export function CollectrChart({ priceHistory, gradeInfos, className }: CollectrChartProps) {
  const { format } = useCurrencyContext();

  const hasRaw = gradeInfos.some(g => g.grade === 'raw');
  const gradedList = gradeInfos.filter(g => g.grade !== 'raw');
  const hasGraded = gradedList.length > 0;

  const [activeTab, setActiveTab] = React.useState<ChartType>(hasGraded ? 'GRADED' : 'RAW');
  
  const defaultGrade = gradedList.find(g => g.grade === '10')?.grade 
    || gradedList.find(g => g.grade === '9')?.grade 
    || gradedList[0]?.grade 
    || 'raw';

  const [activeGrade, setActiveGrade] = React.useState<string>(defaultGrade);
  const [timeRange, setTimeRange] = React.useState<TimeRange>('3M');

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

  const { chartData, minPrice, maxPrice } = React.useMemo(() => {
    const now = new Date();
    const ranges: Record<TimeRange, number> = {
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '12M': 365,
      MAX: Infinity,
    };

    const daysAgo = ranges[timeRange];
    const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    const relevantHistory = filteredByGrade.filter(point => {
      if (timeRange === 'MAX') return true;
      return new Date(point.recorded_at) >= cutoff;
    });

    const chartDataMap = new Map<string, Record<string, string | number>>();
    let min = Infinity;
    let max = -Infinity;

    relevantHistory.forEach(h => {
      const date = h.recorded_at.split('T')[0];
      const source = h.source || 'Market';

      if (!chartDataMap.has(date)) {
        chartDataMap.set(date, { date });
      }
      const entry = chartDataMap.get(date)!;
      entry[source] = h.price;
      
      if (h.price < min) min = h.price;
      if (h.price > max) max = h.price;
    });

    // We need to create a single 'value' for the line chart (average of sources, or just pick one)
    // For simplicity, we just take the first source's price or average them.
    const finalData = Array.from(chartDataMap.values()).map(entry => {
        let sum = 0;
        let count = 0;
        for (const [k, v] of Object.entries(entry)) {
            if (k !== 'date' && typeof v === 'number') {
                sum += v;
                count++;
            }
        }
        return {
            ...entry,
            price: count > 0 ? sum / count : 0,
            dateDisplay: entry.date
        };
    }).sort((a, b) => new Date(a.dateDisplay as string).getTime() - new Date(b.dateDisplay as string).getTime());

    return {
      chartData: finalData,
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

  // Share of graded copies that came back a 10 — the standard collector read on how
  // hard a card is to gem. Null (and hidden) unless we actually hold population counts.
  const gemRate = React.useMemo(() => {
    let tenPop = 0;
    let totalPop = 0;
    for (const g of gradedList) {
      if (g.population == null) continue;
      totalPop += g.population;
      if (parseFloat(g.grade) === 10) tenPop += g.population;
    }
    return totalPop > 0 ? (tenPop / totalPop) * 100 : null;
  }, [gradedList]);

  return (
    <div className={cn('flex flex-col space-y-4 rounded-3xl bg-[#0b1329]/80 backdrop-blur-sm border border-white/10 text-white p-5 shadow-2xl relative overflow-hidden', className)}>
      
      {/* Top Header Row */}
      <div className="relative z-10 flex items-center justify-between w-full">
        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="w-4 h-1.5 rounded-full bg-[#2dd4bf]" />
          {/* Label the series by what it actually is. "Holofoil" was hardcoded and
              asserted a finish we do not track for One Piece or Dragon Ball. */}
          <h2 className="text-sm font-medium text-gray-300">
              {activeTab === 'GRADED' && activeGrade !== 'raw' ? `PSA ${activeGrade}` : 'Raw'}
          </h2>
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
              onClick={() => setActiveTab('GRADED')}
              disabled={!hasGraded}
              className={cn("flex-1 py-1.5 text-[11px] font-bold rounded-full transition-colors uppercase tracking-wider", 
                  activeTab === 'GRADED' ? "bg-[#3f3f46] text-white" : "text-gray-400 hover:text-white",
                  !hasGraded && "opacity-30 cursor-not-allowed")}
          >
              Graded
          </button>
        </div>
      </div>

      {/* The Chart */}
      <div className="relative z-10 h-[240px] w-full mt-2 -ml-2">
        {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
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
                        <div className="rounded-lg border border-[#3f3f46] bg-[#18181b] p-3 shadow-xl">
                            <p className="mb-1 text-xs text-zinc-400">{label ? formatDate(String(label)) : ''}</p>
                            <span className="font-bold text-white tabular-nums">
                            {format(payload[0].value as number)}
                            </span>
                        </div>
                        );
                    }}
                />
                <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#2dd4bf" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorTeal)" 
                    isAnimationActive={false}
                />
            </AreaChart>
            </ResponsiveContainer>
        ) : (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-zinc-600 font-medium text-sm">Not enough chart data for this period.</p>
            </div>
        )}
      </div>

      {/* Time Range Toggles */}
      <div className="relative z-10 flex items-center justify-center gap-1 sm:gap-3 text-sm font-bold mt-2">
        {(['1M', '3M', '6M', '12M', 'MAX'] as TimeRange[]).map((tr) => {
            const isActive = timeRange === tr;
            return (
                <button
                    key={tr}
                    onClick={() => setTimeRange(tr)}
                    className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center transition-all",
                        isActive ? "bg-white text-black" : "text-gray-400 hover:text-white"
                    )}
                >
                    {tr}
                </button>
            );
        })}
      </div>

      {/* Graded Swipe Box */}
      {activeTab === 'GRADED' && hasGraded && (
          <div className="mt-4 border-t border-[#222222] pt-4">
            {Object.entries(gradedByCompany).map(([company, grades]) => (
                <div key={company} className="mb-4 last:mb-0">
                    <h3 className="text-[13px] font-bold text-white mb-2 ml-1">{company}</h3>
                    <div className="flex overflow-x-auto gap-[1px] bg-[#222] p-[1px] rounded-lg border border-[#333] no-scrollbar">
                        {grades.map(g => {
                            const isSelected = activeGrade === g.grade;
                            return (
                                <button
                                    key={g.grade}
                                    onClick={() => setActiveGrade(g.grade)}
                                    className={cn(
                                        "flex-1 min-w-[72px] flex flex-col items-center justify-center py-3 px-1 transition-all",
                                        isSelected ? "bg-orange-500/20 text-orange-400 shadow-inner" : "bg-transparent text-zinc-400 hover:bg-white/5"
                                    )}
                                >
                                    <span className="text-sm font-bold mb-1">{g.grade}</span>
                                    <span className="text-[12px] font-medium tracking-tight mb-0.5">{format(g.price)}</span>
                                    <span className="text-[11px] text-gray-500 font-medium">{g.population ?? '--'}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
            {/* Real gem rate from population counts. This used to render a
                clickable-looking "Gem Rate: Holofoil (N/A)" that was inert and
                had no data behind it; now it only appears when we can compute it. */}
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
