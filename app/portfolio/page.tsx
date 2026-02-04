'use client';

import * as React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  PieChart,
  Award,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PriceChart } from '@/components/charts/price-chart';
import { formatPrice, formatPriceChange, formatDate, cn } from '@/lib/utils';

// Mock portfolio data
const portfolioSummary = {
  total_value: 125000,
  total_cost_basis: 95000,
  total_gain_loss: 30000,
  total_gain_loss_percent: 31.58,
  card_count: 47,
  change_24h: 2500,
  change_24h_percent: 2.04,
  change_7d: 5200,
  change_7d_percent: 4.34,
  change_30d: 12500,
  change_30d_percent: 11.11,
};

const topPerformers = [
  {
    id: '1',
    name: 'Charizard',
    set: 'Base Set',
    grade: 'PSA 10',
    cost_basis: 35000,
    current_value: 42000,
    gain_percent: 20,
  },
  {
    id: '2',
    name: 'Pikachu Illustrator',
    set: 'Promo',
    grade: 'PSA 9',
    cost_basis: 280000,
    current_value: 375000,
    gain_percent: 33.9,
  },
  {
    id: '3',
    name: 'Lugia',
    set: 'Neo Genesis',
    grade: 'PSA 10',
    cost_basis: 8000,
    current_value: 12500,
    gain_percent: 56.25,
  },
];

const worstPerformers = [
  {
    id: '4',
    name: 'Mewtwo',
    set: 'Base Set',
    grade: 'PSA 9',
    cost_basis: 1500,
    current_value: 1200,
    gain_percent: -20,
  },
  {
    id: '5',
    name: 'Gyarados',
    set: 'Base Set',
    grade: 'PSA 8',
    cost_basis: 400,
    current_value: 350,
    gain_percent: -12.5,
  },
];

const portfolioByGame = [
  { game: 'Pokemon', value: 85000, percentage: 68, color: 'bg-yellow-500' },
  { game: 'Basketball', value: 28000, percentage: 22.4, color: 'bg-orange-500' },
  { game: 'Baseball', value: 12000, percentage: 9.6, color: 'bg-blue-500' },
];

const portfolioByGrade = [
  { grade: 'PSA 10', value: 75000, percentage: 60, color: 'bg-emerald-500' },
  { grade: 'PSA 9', value: 35000, percentage: 28, color: 'bg-green-500' },
  { grade: 'PSA 8', value: 10000, percentage: 8, color: 'bg-lime-500' },
  { grade: 'Raw', value: 5000, percentage: 4, color: 'bg-zinc-400' },
];

const recentActivity = [
  { type: 'value_change', card: 'Charizard', change: 2500, date: '2024-01-20' },
  { type: 'added', card: 'Venusaur PSA 9', price: 2800, date: '2024-01-18' },
  { type: 'value_change', card: 'Lugia', change: -300, date: '2024-01-17' },
  { type: 'added', card: 'Blastoise PSA 8', price: 1500, date: '2024-01-15' },
];

const mockPortfolioHistory = [
  { date: '2023-07-01', price: 85000 },
  { date: '2023-08-01', price: 92000 },
  { date: '2023-09-01', price: 88000 },
  { date: '2023-10-01', price: 95000 },
  { date: '2023-11-01', price: 105000 },
  { date: '2023-12-01', price: 112000 },
  { date: '2024-01-01', price: 125000 },
];

export default function PortfolioPage() {
  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-zinc-50">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-zinc-900">Portfolio</h1>
          <p className="mt-1 text-zinc-500">Track your investment performance</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">Total Value</p>
                <DollarSign className="h-4 w-4 text-zinc-400" />
              </div>
              <p className="mt-2 text-3xl font-bold text-zinc-900">
                {formatPrice(portfolioSummary.total_value)}
              </p>
              <div className="mt-2 flex items-center gap-1 text-sm">
                {portfolioSummary.change_24h >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={
                    portfolioSummary.change_24h >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }
                >
                  {formatPrice(Math.abs(portfolioSummary.change_24h))} (24h)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">Total Gain/Loss</p>
                <TrendingUp className="h-4 w-4 text-zinc-400" />
              </div>
              <p
                className={cn(
                  'mt-2 text-3xl font-bold',
                  portfolioSummary.total_gain_loss >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {portfolioSummary.total_gain_loss >= 0 ? '+' : ''}
                {formatPrice(portfolioSummary.total_gain_loss)}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {formatPriceChange(portfolioSummary.total_gain_loss_percent)} all-time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">Cost Basis</p>
                <BarChart3 className="h-4 w-4 text-zinc-400" />
              </div>
              <p className="mt-2 text-3xl font-bold text-zinc-900">
                {formatPrice(portfolioSummary.total_cost_basis)}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {portfolioSummary.card_count} cards
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-500">30 Day Performance</p>
                <Award className="h-4 w-4 text-zinc-400" />
              </div>
              <p
                className={cn(
                  'mt-2 text-3xl font-bold',
                  portfolioSummary.change_30d >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {formatPriceChange(portfolioSummary.change_30d_percent)}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {portfolioSummary.change_30d >= 0 ? '+' : ''}
                {formatPrice(portfolioSummary.change_30d)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart & Breakdown */}
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {/* Portfolio Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Portfolio Value Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceChart data={mockPortfolioHistory} height={300} />
            </CardContent>
          </Card>

          {/* Breakdown */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PieChart className="h-4 w-4" />
                  By Category
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {portfolioByGame.map((item) => (
                  <div key={item.game}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-700">{item.game}</span>
                      <span className="font-medium text-zinc-900">
                        {formatPrice(item.value)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={cn('h-full', item.color)}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-4 w-4" />
                  By Grade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {portfolioByGrade.map((item) => (
                  <div key={item.grade}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-700">{item.grade}</span>
                      <span className="font-medium text-zinc-900">
                        {formatPrice(item.value)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={cn('h-full', item.color)}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Top/Worst Performers */}
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topPerformers.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 p-3"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{item.name}</p>
                    <p className="text-sm text-zinc-500">
                      {item.set} - {item.grade}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-zinc-900">
                      {formatPrice(item.current_value)}
                    </p>
                    <p className="text-sm font-medium text-emerald-600">
                      {formatPriceChange(item.gain_percent)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                Worst Performers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {worstPerformers.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 p-3"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{item.name}</p>
                    <p className="text-sm text-zinc-500">
                      {item.set} - {item.grade}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-zinc-900">
                      {formatPrice(item.current_value)}
                    </p>
                    <p className="text-sm font-medium text-red-600">
                      {formatPriceChange(item.gain_percent)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between border-b border-zinc-100 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full',
                        activity.type === 'added'
                          ? 'bg-blue-100'
                          : activity.change && activity.change >= 0
                          ? 'bg-emerald-100'
                          : 'bg-red-100'
                      )}
                    >
                      {activity.type === 'added' ? (
                        <DollarSign className="h-5 w-5 text-blue-600" />
                      ) : activity.change && activity.change >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900">
                        {activity.type === 'added'
                          ? `Added ${activity.card}`
                          : `${activity.card} value changed`}
                      </p>
                      <p className="text-sm text-zinc-500">{formatDate(activity.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {activity.type === 'added' ? (
                      <p className="font-medium text-zinc-900">
                        {formatPrice(activity.price!)}
                      </p>
                    ) : (
                      <p
                        className={cn(
                          'font-medium',
                          activity.change! >= 0 ? 'text-emerald-600' : 'text-red-600'
                        )}
                      >
                        {activity.change! >= 0 ? '+' : ''}
                        {formatPrice(activity.change!)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
