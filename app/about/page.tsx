import { Metadata } from 'next';
import Link from 'next/link';
import {
  TrendingUp,
  Shield,
  Zap,
  Users,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'About TCGMaster | Your TCG Price Intelligence Platform',
  description:
    'TCGMaster helps collectors and investors track TCG prices, manage collections, and make smarter decisions. Learn about our mission and platform.',
  openGraph: {
    title: 'About TCGMaster | Your TCG Price Intelligence Platform',
    description:
      'TCGMaster helps collectors and investors track TCG prices, manage collections, and make smarter decisions.',
    type: 'website',
    siteName: 'TCGMaster',
  },
  other: {
    'application/ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'TCGMaster',
      description: 'TCG price intelligence platform for collectors and investors',
      url: 'https://tcgmaster.com',
      logo: 'https://tcgmaster.com/logo.png',
      foundingDate: '2024',
      founders: [
        {
          '@type': 'Person',
          name: 'TCGMaster Team',
        },
      ],
    }),
  },
};

const features = [
  {
    icon: TrendingUp,
    title: 'Real-Time Price Tracking',
    description:
      'Track prices across multiple marketplaces with live updates. Never miss a deal or market movement.',
  },
  {
    icon: Shield,
    title: 'Grading Intelligence',
    description:
      'Compare prices across PSA, BGS, CGC, and SGC grades. Understand the true value of your cards.',
  },
  {
    icon: Zap,
    title: 'Instant Alerts',
    description:
      'Set custom price alerts and get notified when cards hit your target price. React faster than the market.',
  },
  {
    icon: BarChart3,
    title: 'Portfolio Analytics',
    description:
      'Track your collection value over time. Understand your ROI and make data-driven decisions.',
  },
];

const stats = [
  { value: '500K+', label: 'Cards Tracked' },
  { value: '50K+', label: 'Active Collectors' },
  { value: '100+', label: 'Sets Covered' },
  { value: '99.9%', label: 'Uptime' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-zinc-50 to-white">
        <div className="container py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 mb-6">
            The Smarter Way to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Collect & Invest
            </span>
          </h1>
          <p className="text-xl text-zinc-600 max-w-2xl mx-auto mb-8">
            TCGMaster is the price intelligence platform that helps collectors and investors make
            smarter decisions with real-time data and powerful analytics.
          </p>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 bg-zinc-50">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-6">
              Collectors Deserve Better Tools
            </h2>
            <p className="text-lg text-zinc-600 mb-8">
              The TCG market moves fast. Prices fluctuate daily. Finding accurate, real-time data
              across grading companies and marketplaces has always been a challenge. Spreadsheets
              can&apos;t keep up. Neither can outdated price guides.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 border border-zinc-200">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-zinc-600">Scattered price data across dozens of sites</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-zinc-200">
                <div className="text-3xl mb-2">⏰</div>
                <p className="text-zinc-600">Outdated information that costs you money</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-zinc-200">
                <div className="text-3xl mb-2">📝</div>
                <p className="text-zinc-600">Manual tracking in messy spreadsheets</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-4">
              One Platform. Complete Control.
            </h2>
            <p className="text-lg text-zinc-600 max-w-2xl mx-auto">
              TCGMaster brings together everything you need to track, analyze, and grow your
              collection with confidence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {features.map((feature) => (
              <div
                key={feature.title}
                className={cn(
                  'flex gap-4 p-6 rounded-xl',
                  'bg-white border border-zinc-200',
                  'hover:border-zinc-300 hover:shadow-sm',
                  'transition-all duration-200'
                )}
              >
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <feature.icon className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 mb-2">{feature.title}</h3>
                  <p className="text-zinc-600 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-zinc-900">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-zinc-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 mb-4">
              Join Thousands of Collectors
            </h2>
            <p className="text-lg text-zinc-600 mb-8">
              Start tracking your collection today. Free to sign up, powerful enough for serious
              collectors.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="min-w-[200px]">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/pokemon">
                <Button variant="outline" size="lg" className="min-w-[200px]">
                  Explore Cards
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
