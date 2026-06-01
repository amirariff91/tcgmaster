import { NextRequest, NextResponse } from 'next/server';
import { lookupBGSCert } from '@/lib/scrapers/bgs';

interface RouteParams {
  params: Promise<{ number: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { number: certNumber } = await params;
  const { searchParams } = new URL(request.url);

  const company = searchParams.get('company') || 'psa';
  // Clean cert number
  const cleanCertNumber = certNumber.replace(/\D/g, '');

  if (!cleanCertNumber || cleanCertNumber.length < 6) {
    return NextResponse.json({
      error: 'Invalid certificate number',
    }, { status: 400 });
  }

  // PSA access is currently unavailable. Do not return cached or scraped
  // heuristic data as verified certificate data.
  if (company.toLowerCase() === 'psa') {
    return NextResponse.json({
      error: 'Cert lookup unavailable — PSA API access required',
      message: 'TCGMaster cannot verify PSA certificates until official PSA API access is configured. Use PSA directly for now.',
      psaUrl: `https://www.psacard.com/cert/${cleanCertNumber}`,
    }, { status: 503 });
  }

  // Scrape from non-PSA grading company integrations only.
  let certData;

  switch (company.toLowerCase()) {
    case 'bgs':
    case 'beckett':
      certData = await lookupBGSCert(cleanCertNumber);
      break;
    default:
      return NextResponse.json({
        error: `Unsupported grading company: ${company}`,
      }, { status: 400 });
  }

  if (!certData) {
    return NextResponse.json({
      error: 'Failed to lookup certificate',
    }, { status: 500 });
  }

  if (!certData.isValid) {
    return NextResponse.json({
      error: certData.error || 'Certificate not found',
      data: certData,
    }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      ...certData,
      source: 'scraped',
    },
  });
}
