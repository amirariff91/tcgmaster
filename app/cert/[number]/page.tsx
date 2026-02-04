import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import {
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Plus,
  Calendar,
  Award,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CardImage } from '@/components/card/card-image';
import { PriceDisplay } from '@/components/card/price-display';
import { PriceChart } from '@/components/charts/price-chart';
import { formatPrice, formatDate, getGradingCompanyDisplay } from '@/lib/utils';

// Mock cert lookup data
const mockCertData = {
  cert_number: '12345678',
  grading_company: 'psa' as const,
  is_valid: true,
  grade: '10' as const,
  cert_date: '2022-05-15',
  cert_image_url: '/cert-images/12345678.jpg',
  fraud_flags: [],
  card: {
    id: '1',
    name: 'Charizard',
    slug: 'charizard-holo',
    number: '4',
    rarity: 'holo-rare',
    artist: 'Mitsuhiro Arita',
    image_url: '/cards/charizard-base.png',
    set: {
      id: '1',
      name: 'Base Set',
      slug: 'base-set',
      release_date: '1999-01-09',
    },
    game: {
      slug: 'pokemon',
      display_name: 'Pokemon',
    },
  },
  price: {
    current: 42000,
    change24h: 2.5,
    confidence: 'high' as const,
    last_sale: '2024-01-15',
  },
  population: {
    same_grade: 47,
    total: 5250,
    percentile: 0.9,
  },
};

const mockPriceHistory = [
  { date: '2023-07-01', price: 35000 },
  { date: '2023-08-01', price: 38000 },
  { date: '2023-09-01', price: 36000 },
  { date: '2023-10-01', price: 39000 },
  { date: '2023-11-01', price: 41000 },
  { date: '2023-12-01', price: 40000 },
  { date: '2024-01-01', price: 42000 },
];

interface PageProps {
  params: Promise<{
    number: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { number } = await params;
  return {
    title: `Cert #${number} Lookup`,
    description: `Verify PSA/BGS certification #${number}. View card details, grade, and current market value.`,
  };
}

export default async function CertLookupResultPage({ params }: PageProps) {
  const { number } = await params;

  // In production, fetch cert data from grading company API
  // If not found or invalid: show error state

  const cert = mockCertData;
  const card = cert.card;

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-zinc-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">Certification Lookup</p>
              <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">
                {getGradingCompanyDisplay(cert.grading_company)} #{number}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {cert.is_valid && cert.fraud_flags.length === 0 ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Review Required
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Fraud Warning */}
        {cert.fraud_flags.length > 0 && (
          <div className="mb-8 rounded-xl border-2 border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-800">
                  Warning: Potential Issues Detected
                </h3>
                <ul className="mt-2 space-y-1 text-sm text-red-700">
                  {cert.fraud_flags.map((flag, index) => (
                    <li key={index}>{flag}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Card & Cert Image */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              {/* Card Image */}
              <Card>
                <CardContent className="pt-6">
                  <CardImage
                    src={card.image_url}
                    alt={card.name}
                    size="xl"
                    className="mx-auto"
                  />
                </CardContent>
              </Card>

              {/* Certification Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-5 w-5" />
                    Certification Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className="text-sm text-zinc-500">Cert Number</dt>
                      <dd className="font-mono font-medium text-zinc-900">
                        {cert.cert_number}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-zinc-500">Grading Company</dt>
                      <dd className="font-medium text-zinc-900">
                        {getGradingCompanyDisplay(cert.grading_company)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-zinc-500">Grade</dt>
                      <dd>
                        <Badge variant="grade">{cert.grade}</Badge>
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-zinc-500">Certification Date</dt>
                      <dd className="font-medium text-zinc-900">
                        {cert.cert_date ? formatDate(cert.cert_date) : 'Unknown'}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 pt-4 border-t border-zinc-200">
                    <a
                      href={`https://www.psacard.com/cert/${cert.cert_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      Verify on {getGradingCompanyDisplay(cert.grading_company)} website
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column - Card Details & Pricing */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card Info & Price */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link
                      href={`/${card.game.slug}/${card.set.slug}/${card.slug}`}
                      className="group"
                    >
                      <h2 className="text-2xl font-bold text-zinc-900 group-hover:text-blue-600 md:text-3xl">
                        {card.name}
                      </h2>
                    </Link>
                    <p className="mt-1 text-zinc-500">
                      {card.set.name} - #{card.number}
                    </p>
                  </div>

                  <div className="text-right">
                    <PriceDisplay
                      price={cert.price.current}
                      change24h={cert.price.change24h}
                      confidence={cert.price.confidence}
                      lastSaleDate={cert.price.last_sale}
                      size="lg"
                      showConfidence={false}
                    />
                    <p className="mt-1 text-sm text-zinc-500">
                      {getGradingCompanyDisplay(cert.grading_company)} {cert.grade} Market Price
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button>
                    <Plus className="h-4 w-4" />
                    Add to Collection
                  </Button>
                  <Link href={`/${card.game.slug}/${card.set.slug}/${card.slug}`}>
                    <Button variant="outline">
                      View Full Card Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Population Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Population Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg bg-zinc-50 p-4">
                    <p className="text-sm text-zinc-500">
                      {getGradingCompanyDisplay(cert.grading_company)} {cert.grade} Population
                    </p>
                    <p className="text-2xl font-bold text-zinc-900">
                      {cert.population.same_grade.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4">
                    <p className="text-sm text-zinc-500">Total Graded</p>
                    <p className="text-2xl font-bold text-zinc-900">
                      {cert.population.total.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4">
                    <p className="text-sm text-zinc-500">Percentile</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      Top {cert.population.percentile}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Rarity Analysis:</strong> This is 1 of only {cert.population.same_grade}{' '}
                    {getGradingCompanyDisplay(cert.grading_company)} {cert.grade}s in existence,
                    placing it in the top {cert.population.percentile}% of all graded copies.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Price History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Price History ({getGradingCompanyDisplay(cert.grading_company)} {cert.grade})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PriceChart data={mockPriceHistory} height={250} />
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Calendar className="h-8 w-8 text-zinc-400" />
                  <h3 className="mt-2 font-semibold text-zinc-900">
                    Track Value Over Time
                  </h3>
                  <p className="mt-1 text-center text-sm text-zinc-500">
                    Add to your collection to track ROI
                  </p>
                  <Button className="mt-4" size="sm">
                    Add with Cost Basis
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Shield className="h-8 w-8 text-zinc-400" />
                  <h3 className="mt-2 font-semibold text-zinc-900">
                    Report an Issue
                  </h3>
                  <p className="mt-1 text-center text-sm text-zinc-500">
                    Help keep our community safe
                  </p>
                  <Button variant="outline" className="mt-4" size="sm">
                    Report Problem
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
