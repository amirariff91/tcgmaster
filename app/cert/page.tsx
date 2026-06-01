'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ExternalLink, Search, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function CertLookupPage() {
  const router = useRouter();
  const [certNumber, setCertNumber] = React.useState('');
  const [error, setError] = React.useState('');

  const cleanedCert = certNumber.replace(/\D/g, '');
  const psaUrl = cleanedCert.length >= 6
    ? `https://www.psacard.com/cert/${cleanedCert}`
    : 'https://www.psacard.com/cert/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!cleanedCert || cleanedCert.length < 6) {
      setError('Please enter a valid PSA certification number (at least 6 digits)');
      return;
    }

    router.push(`/cert/${cleanedCert}`);
  };

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 to-white">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1 text-sm font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              PSA lookup temporarily unavailable
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl">
              Cert Number Lookup
            </h1>
            <p className="mb-8 text-lg text-zinc-600">
              TCGMaster cannot currently verify PSA certs inside the app because official PSA API access is not configured. Enter a PSA cert to open the official PSA lookup page, or check back after integration is enabled.
            </p>

            <Card className="text-left">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      PSA Certification Number
                    </label>
                    <Input
                      type="text"
                      placeholder="Enter PSA cert number"
                      value={certNumber}
                      onChange={(e) => setCertNumber(e.target.value)}
                      icon={<Search className="h-4 w-4" />}
                      error={error}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button type="submit" className="w-full" size="lg">
                      <Search className="h-4 w-4" />
                      View TCGMaster notice
                    </Button>
                    <a
                      href={psaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                    >
                      Open PSA directly
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                What works right now
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-zinc-600">
              <p>• We can route you to the official PSA lookup page.</p>
              <p>• We do not mark any cert as verified unless official data access is available.</p>
              <p>• TCGMaster card pricing still works separately where source-backed data exists.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Not currently supported
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-zinc-600">
              <p>• In-app PSA verification.</p>
              <p>• CGC, SGC, and BGS cert verification from this form.</p>
              <p>• Auto-adding verified cert data to collections.</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
