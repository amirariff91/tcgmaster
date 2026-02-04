'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Types for Lightweight Charts
interface OHLCData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface LineData {
  time: string;
  value: number;
}

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

interface LightweightChartProps {
  data: OHLCData[] | LineData[];
  className?: string;
  height?: number;
  chartType?: 'candlestick' | 'line' | 'area';
  showVolume?: boolean;
  showTimeRange?: boolean;
  onTimeRangeChange?: (range: TimeRange) => void;
  defaultTimeRange?: TimeRange;
  colors?: {
    upColor?: string;
    downColor?: string;
    wickUpColor?: string;
    wickDownColor?: string;
    lineColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
  };
}

// Muted color palette
const DEFAULT_COLORS = {
  upColor: '#14b8a6', // teal-500
  downColor: '#f87171', // red-400
  wickUpColor: '#14b8a6',
  wickDownColor: '#f87171',
  lineColor: '#14b8a6',
  areaTopColor: 'rgba(20, 184, 166, 0.3)',
  areaBottomColor: 'rgba(20, 184, 166, 0.0)',
};

const DARK_COLORS = {
  upColor: '#2dd4bf', // teal-400
  downColor: '#fb7185', // rose-400
  wickUpColor: '#2dd4bf',
  wickDownColor: '#fb7185',
  lineColor: '#2dd4bf',
  areaTopColor: 'rgba(45, 212, 191, 0.3)',
  areaBottomColor: 'rgba(45, 212, 191, 0.0)',
};

// Type guard to check if a single data point is OHLC
function isOHLCDataPoint(point: OHLCData | LineData): point is OHLCData {
  return 'open' in point;
}

// Check if array contains OHLC data (checks first element)
function hasOHLCData(data: (OHLCData | LineData)[]): boolean {
  return data.length > 0 && 'open' in data[0];
}

// Helper to get price from data point
function getPrice(point: OHLCData | LineData): number {
  return isOHLCDataPoint(point) ? point.close : point.value;
}

// Convert OHLC to line data
function ohlcToLine(data: OHLCData[]): LineData[] {
  return data.map((d) => ({ time: d.time, value: d.close }));
}

export function LightweightChart({
  data,
  className,
  height = 300,
  chartType = 'candlestick',
  showVolume = false,
  showTimeRange = true,
  onTimeRangeChange,
  defaultTimeRange = '30d',
  colors: customColors,
}: LightweightChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = React.useRef<any>(null);
  const [timeRange, setTimeRange] = React.useState<TimeRange>(defaultTimeRange);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDark, setIsDark] = React.useState(false);

  // Detect dark mode
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Get colors based on theme
  const colors = React.useMemo(() => {
    const baseColors = isDark ? DARK_COLORS : DEFAULT_COLORS;
    return { ...baseColors, ...customColors };
  }, [isDark, customColors]);

  // Filter data based on time range
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
    if (daysAgo === Infinity) return data;

    const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return data.filter((point) => new Date(point.time) >= cutoff);
  }, [data, timeRange]);

  // Calculate price change
  const priceChange = React.useMemo(() => {
    if (filteredData.length < 2) return 0;
    const firstPrice = getPrice(filteredData[0]);
    const lastPrice = getPrice(filteredData[filteredData.length - 1]);
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  }, [filteredData]);

  // Initialize and update chart
  React.useEffect(() => {
    if (!containerRef.current || filteredData.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;

    const initChart = async () => {
      setIsLoading(true);

      try {
        // Dynamic import to avoid SSR issues - import v5 series types
        const lw = await import('lightweight-charts');
        const { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, AreaSeries, HistogramSeries } = lw;

        // Clean up existing chart
        if (chartRef.current) {
          chartRef.current.remove();
        }

        // Create new chart
        chart = createChart(containerRef.current!, {
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: isDark ? '#a1a1aa' : '#71717a',
          },
          grid: {
            vertLines: { color: isDark ? '#27272a' : '#e4e4e7' },
            horzLines: { color: isDark ? '#27272a' : '#e4e4e7' },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
          },
          rightPriceScale: {
            borderVisible: false,
          },
          timeScale: {
            borderVisible: false,
            timeVisible: true,
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: false,
          },
          handleScale: {
            mouseWheel: true,
            pinch: true,
            axisPressedMouseMove: true,
          },
        });

        // Add appropriate series based on chart type
        const isOHLC = hasOHLCData(filteredData);

        if (chartType === 'candlestick' && isOHLC) {
          const ohlcData = filteredData as OHLCData[];
          const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: colors.upColor,
            downColor: colors.downColor,
            borderVisible: false,
            wickUpColor: colors.wickUpColor,
            wickDownColor: colors.wickDownColor,
          });
          candleSeries.setData(
            ohlcData.map((d) => ({
              time: d.time,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
            }))
          );

          // Add volume if requested
          if (showVolume) {
            const volumeSeries = chart.addSeries(HistogramSeries, {
              priceFormat: { type: 'volume' },
              priceScaleId: '',
            });
            volumeSeries.priceScale().applyOptions({
              scaleMargins: { top: 0.8, bottom: 0 },
            });
            volumeSeries.setData(
              ohlcData
                .filter((d) => d.volume !== undefined)
                .map((d) => ({
                  time: d.time,
                  value: d.volume!,
                  color: d.close >= d.open ? colors.upColor + '50' : colors.downColor + '50',
                }))
            );
          }
        } else if (chartType === 'area') {
          const lineData = isOHLC ? ohlcToLine(filteredData as OHLCData[]) : (filteredData as LineData[]);
          const areaSeries = chart.addSeries(AreaSeries, {
            lineColor: colors.lineColor,
            topColor: colors.areaTopColor,
            bottomColor: colors.areaBottomColor,
            lineWidth: 2,
          });
          areaSeries.setData(lineData);
        } else {
          const lineData = isOHLC ? ohlcToLine(filteredData as OHLCData[]) : (filteredData as LineData[]);
          const lineSeries = chart.addSeries(LineSeries, {
            color: colors.lineColor,
            lineWidth: 2,
          });
          lineSeries.setData(lineData);
        }

        // Fit content
        chart.timeScale().fitContent();
        chartRef.current = chart;
      } catch (error) {
        console.error('Failed to initialize chart:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initChart();

    // Handle resize
    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [filteredData, chartType, showVolume, colors, isDark]);

  // Handle time range change
  const handleTimeRangeChange = (value: string) => {
    const newRange = value as TimeRange;
    setTimeRange(newRange);
    onTimeRangeChange?.(newRange);
  };

  const isPositive = priceChange >= 0;

  return (
    <div className={cn('space-y-4', className)}>
      {showTimeRange && (
        <div className="flex items-center justify-between">
          <Tabs defaultValue={defaultTimeRange} value={timeRange} onValueChange={handleTimeRangeChange}>
            <TabsList>
              <TabsTrigger value="7d">7D</TabsTrigger>
              <TabsTrigger value="30d">30D</TabsTrigger>
              <TabsTrigger value="90d">90D</TabsTrigger>
              <TabsTrigger value="1y">1Y</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>

          <div
            className={cn('text-sm font-medium', isPositive ? 'text-teal-500' : 'text-red-400')}
          >
            {isPositive ? '+' : ''}
            {priceChange.toFixed(1)}%
          </div>
        </div>
      )}

      {/* Chart container with horizontal scroll on mobile */}
      <div className="chart-scroll-container">
        <div
          ref={containerRef}
          style={{ height, minWidth: 600 }}
          className="relative"
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-50/50">
              <Skeleton className="h-full w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Export types for external use
export type { OHLCData, LineData, TimeRange };
