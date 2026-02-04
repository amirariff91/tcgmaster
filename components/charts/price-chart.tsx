'use client';

import * as React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { formatPrice, formatDate } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { priceArrayToOHLC, generateMockCardHistory } from '@/lib/charts/generate-ohlc';
import type { OHLCData } from './lightweight-chart';

// Dynamically import LightweightChart to avoid SSR issues
const LightweightChart = dynamic(
  () => import('./lightweight-chart').then((mod) => mod.LightweightChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full" />,
  }
);

interface PriceDataPoint {
  date: string;
  price: number;
  grade?: string;
}

interface PriceChartProps {
  data: PriceDataPoint[];
  className?: string;
  height?: number;
  showGradient?: boolean;
  variant?: 'recharts' | 'lightweight' | 'ohlc';
}

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

export function PriceChart({
  data,
  className,
  height = 300,
  showGradient = true,
  variant = 'recharts',
}: PriceChartProps) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>('30d');

  // If using lightweight chart or OHLC variant
  if (variant === 'lightweight' || variant === 'ohlc') {
    // Convert price data to appropriate format
    const chartData = variant === 'ohlc' ? priceArrayToOHLC(data) : data.map((d) => ({
      time: d.date,
      value: d.price,
    }));

    return (
      <LightweightChart
        data={chartData as OHLCData[]}
        className={className}
        height={height}
        chartType={variant === 'ohlc' ? 'candlestick' : 'area'}
        showVolume={false}
        showTimeRange={true}
        defaultTimeRange="30d"
      />
    );
  }

  // Original Recharts implementation below

  const filteredData = React.useMemo(() => {
    const now = new Date();
    const ranges: Record<TimeRange, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365,
      all: Infinity,
    };

    const daysAgo = ranges[timeRange];
    const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    return data.filter((point) => {
      if (timeRange === 'all') return true;
      return new Date(point.date) >= cutoff;
    });
  }, [data, timeRange]);

  const priceChange = React.useMemo(() => {
    if (filteredData.length < 2) return 0;
    const first = filteredData[0].price;
    const last = filteredData[filteredData.length - 1].price;
    return ((last - first) / first) * 100;
  }, [filteredData]);

  const isPositive = priceChange >= 0;
  const lineColor = isPositive ? '#10b981' : '#ef4444';
  const gradientId = `priceGradient-${React.useId()}`;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <Tabs defaultValue="30d" value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <TabsList>
            <TabsTrigger value="7d">7D</TabsTrigger>
            <TabsTrigger value="30d">30D</TabsTrigger>
            <TabsTrigger value="90d">90D</TabsTrigger>
            <TabsTrigger value="1y">1Y</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className={cn('text-sm font-medium', isPositive ? 'text-emerald-500' : 'text-red-500')}>
          {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        {showGradient ? (
          <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
              stroke="#a1a1aa"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(value) => formatPrice(value)}
              stroke="#a1a1aa"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-lg ">
                    <p className="text-sm text-zinc-500">{label ? formatDate(String(label)) : ''}</p>
                    <p className="text-lg font-bold text-zinc-900 ">
                      {formatPrice(payload[0].value as number)}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={lineColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        ) : (
          <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
              stroke="#a1a1aa"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(value) => formatPrice(value)}
              stroke="#a1a1aa"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-lg ">
                    <p className="text-sm text-zinc-500">{label ? formatDate(String(label)) : ''}</p>
                    <p className="text-lg font-bold text-zinc-900 ">
                      {formatPrice(payload[0].value as number)}
                    </p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: lineColor }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

interface MultiGradePriceChartProps {
  data: Record<string, PriceDataPoint[]>;
  grades: string[];
  className?: string;
  height?: number;
}

const gradeColors: Record<string, string> = {
  raw: '#71717a',
  '7': '#f59e0b',
  '8': '#84cc16',
  '9': '#22c55e',
  '10': '#10b981',
};

export function MultiGradePriceChart({
  data,
  grades,
  className,
  height = 300,
}: MultiGradePriceChartProps) {
  const [activeGrades, setActiveGrades] = React.useState<Set<string>>(new Set(grades));

  const mergedData = React.useMemo(() => {
    const allDates = new Set<string>();
    Object.values(data).forEach((points) => {
      points.forEach((point) => allDates.add(point.date));
    });

    const sortedDates = Array.from(allDates).sort();
    return sortedDates.map((date) => {
      const point: Record<string, unknown> = { date };
      grades.forEach((grade) => {
        const gradeData = data[grade]?.find((p) => p.date === date);
        point[grade] = gradeData?.price;
      });
      return point;
    });
  }, [data, grades]);

  const toggleGrade = (grade: string) => {
    const newSet = new Set(activeGrades);
    if (newSet.has(grade)) {
      newSet.delete(grade);
    } else {
      newSet.add(grade);
    }
    setActiveGrades(newSet);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap gap-2">
        {grades.map((grade) => (
          <button
            key={grade}
            onClick={() => toggleGrade(grade)}
            className={cn(
              'rounded-full px-3 py-1 text-sm font-medium transition-colors',
              activeGrades.has(grade)
                ? 'text-white'
                : 'bg-zinc-100 text-zinc-400 '
            )}
            style={{
              backgroundColor: activeGrades.has(grade)
                ? gradeColors[grade] || '#71717a'
                : undefined,
            }}
          >
            {grade === 'raw' ? 'Raw' : `Grade ${grade}`}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={mergedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }}
            stroke="#a1a1aa"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(value) => formatPrice(value)}
            stroke="#a1a1aa"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-lg ">
                  <p className="mb-2 text-sm text-zinc-500">{label ? formatDate(String(label)) : ''}</p>
                  {payload.map((entry) => (
                    <div key={entry.dataKey} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-sm text-zinc-600 ">
                        {entry.dataKey === 'raw' ? 'Raw' : `Grade ${entry.dataKey}`}:
                      </span>
                      <span className="font-medium text-zinc-900 ">
                        {formatPrice(entry.value as number)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          {grades.map((grade) => (
            <Line
              key={grade}
              type="monotone"
              dataKey={grade}
              stroke={gradeColors[grade] || '#71717a'}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
              hide={!activeGrades.has(grade)}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * OHLC Price Chart using Lightweight Charts
 * For candlestick/OHLC display with professional trading features
 */
interface OHLCPriceChartProps {
  data: OHLCData[];
  className?: string;
  height?: number;
  showVolume?: boolean;
}

export function OHLCPriceChart({
  data,
  className,
  height = 300,
  showVolume = false,
}: OHLCPriceChartProps) {
  return (
    <LightweightChart
      data={data}
      className={className}
      height={height}
      chartType="candlestick"
      showVolume={showVolume}
      showTimeRange={true}
      defaultTimeRange="30d"
    />
  );
}

/**
 * Generate and display mock OHLC chart for a card
 * Useful for demo/placeholder when no real OHLC data exists
 */
interface MockOHLCChartProps {
  currentPrice: number;
  className?: string;
  height?: number;
}

export function MockOHLCChart({
  currentPrice,
  className,
  height = 300,
}: MockOHLCChartProps) {
  const [chartData, setChartData] = React.useState<OHLCData[]>([]);

  React.useEffect(() => {
    // Generate mock data on mount (client-side only)
    const { daily, weekly } = generateMockCardHistory(currentPrice);
    // Combine weekly historical with recent daily
    setChartData([...weekly, ...daily]);
  }, [currentPrice]);

  if (chartData.length === 0) {
    return <Skeleton className={cn('w-full', className)} style={{ height }} />;
  }

  return (
    <LightweightChart
      data={chartData}
      className={className}
      height={height}
      chartType="candlestick"
      showVolume={false}
      showTimeRange={true}
      defaultTimeRange="30d"
    />
  );
}
