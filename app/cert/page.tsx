'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, Shield, Zap, Plus, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

const gradingCompanies = [
  { value: 'psa', label: 'PSA' },
  { value: 'bgs', label: 'BGS' },
  { value: 'cgc', label: 'CGC' },
  { value: 'sgc', label: 'SGC' },
];

const recentLookups = [
  { cert: '12345678', company: 'PSA', card: 'Charizard - Base Set', grade: '10' },
  { cert: '87654321', company: 'BGS', card: 'Michael Jordan RC', grade: '9.5' },
  { cert: '11223344', company: 'PSA', card: 'Pikachu Illustrator', grade: '9' },
];

export default function CertLookupPage() {
  const router = useRouter();
  const [certNumber, setCertNumber] = React.useState('');
  const [company, setCompany] = React.useState('psa');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic validation
    const cleanedCert = certNumber.replace(/\D/g, '');
    if (!cleanedCert || cleanedCert.length < 6) {
      setError('Please enter a valid certification number (at least 6 digits)');
      return;
    }

    setIsLoading(true);

    // Navigate to cert result page
    router.push(`/cert/${cleanedCert}`);
  };

  const handleQuickLookup = (cert: string) => {
    router.push(`/cert/${cert}`);
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1 text-sm font-medium text-blue-700">
              <Shield className="h-4 w-4" />
              Instant Verification
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl">
              Cert Number Lookup
            </h1>
            <p className="mb-8 text-lg text-zinc-600">
              Instantly verify PSA, BGS, CGC, or SGC certifications. View card details, grade,
              population data, and current market value.
            </p>

            {/* Lookup Form */}
            <Card className="text-left">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div className="sm:col-span-1">
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Company
                      </label>
                      <Select
                        options={gradingCompanies}
                        value={company}
                        onChange={setCompany}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Certification Number
                      </label>
                      <Input
                        type="text"
                        placeholder="Enter cert number (e.g., 12345678)"
                        value={certNumber}
                        onChange={(e) => setCertNumber(e.target.value)}
                        icon={<Search className="h-4 w-4" />}
                        error={error}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                    <Search className="h-4 w-4" />
                    Look Up Certification
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-8 text-center text-2xl font-bold text-zinc-900">
          Why Use Our Cert Lookup?
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                Verify Authenticity
              </h3>
              <p className="text-zinc-600">
                Cross-reference cert numbers against grading company records. Identify potential
                fakes or re-holdered slabs.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                Instant Price Data
              </h3>
              <p className="text-zinc-600">
                See current market value for the exact card and grade. Make informed buying
                decisions in seconds.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                <Plus className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-900">
                Auto-Add to Collection
              </h3>
              <p className="text-zinc-600">
                One click to add verified cards to your collection. All details are automatically
                populated.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Recent Lookups (for logged-in users) */}
      <section className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Popular Recent Lookups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentLookups.map((lookup, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickLookup(lookup.cert)}
                  className="flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors hover:bg-zinc-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 font-bold text-zinc-500">
                      {lookup.company}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900">{lookup.card}</p>
                      <p className="text-sm text-zinc-500">
                        {lookup.company} #{lookup.cert}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-800">
                      Grade {lookup.grade}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Batch Import CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 p-8 text-center text-white md:p-12">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">Have Multiple Certs?</h2>
          <p className="mb-6 text-lg text-white/80">
            Import a list of certification numbers and build your collection in seconds.
          </p>
          <Button size="lg" className="bg-white text-purple-600 hover:bg-zinc-100">
            <Plus className="h-4 w-4" />
            Batch Import Certs
          </Button>
        </div>
      </section>
    </div>
  );
}
