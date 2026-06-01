import Link from 'next/link';
import { Metadata } from 'next';
import {
  AlertTriangle,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PageProps {
  params: Promise<{
    number: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { number } = await params;
  return {
    title: `Cert #${number} Lookup`,
    description: `PSA certificate #${number} cannot currently be verified inside TCGMaster because PSA API access is not configured.` ,
  };
}

export default async function CertLookupResultPage({ params }: PageProps) {
  const { number } = await params;

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-zinc-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">Certification Lookup</p>
              <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">
                PSA #{number}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Unavailable Notice */}
        <Card className="border-2 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Cert Lookup Unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-amber-900">
              <strong>Cert lookup unavailable — PSA API access required.</strong>
            </p>
            <p className="text-sm text-amber-800">
              TCGMaster does not currently have a valid PSA API token. We cannot verify
              certificate #{number} at this time.
            </p>
            <p className="text-sm text-amber-800">
              To verify this certificate, please visit the official PSA website directly:
            </p>
            <a
              href={`https://www.psacard.com/cert/${number}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
            >
              Verify cert #{number} on PSA Card website
              <ExternalLink className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" />
              Why can&apos;t we verify this cert?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-600">
            <p>
              PSA (Professional Sports Authenticator) requires an API token or subscription
              to access their certification database programmatically. TCGMaster currently
              uses the public cert lookup URL, which is restricted.
            </p>
            <p>
              We are working on obtaining the necessary access. Until then, please use the
              official PSA website link above to verify any certificate.
            </p>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-center">
          <Link href="/">
            <Button variant="outline">Back to TCGMaster</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
