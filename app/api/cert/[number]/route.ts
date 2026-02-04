import { NextRequest, NextResponse } from 'next/server';
import { lookupPSACert, getCertFromDb } from '@/lib/scrapers/psa';
import { lookupBGSCert } from '@/lib/scrapers/bgs';

interface RouteParams {
  params: Promise<{ number: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { number: certNumber } = await params;
  const { searchParams } = new URL(request.url);

  const company = searchParams.get('company') || 'psa';
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Clean cert number
  const cleanCertNumber = certNumber.replace(/\D/g, '');

  if (!cleanCertNumber || cleanCertNumber.length < 6) {
    return NextResponse.json({
      error: 'Invalid certificate number',
    }, { status: 400 });
  }

  // Try database first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getCertFromDb(cleanCertNumber);
    if (cached) {
      return NextResponse.json({
        data: {
          ...cached,
          source: 'database',
        },
      });
    }
  }

  // Scrape from grading company
  let certData;

  switch (company.toLowerCase()) {
    case 'psa':
      certData = await lookupPSACert(cleanCertNumber);
      break;
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
