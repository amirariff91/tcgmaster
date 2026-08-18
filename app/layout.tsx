import type { Metadata } from 'next';
import { Inter, Newsreader } from 'next/font/google';
import { GoogleTagManager } from '@next/third-parties/google';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Providers } from './providers';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const newsreader = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'TCGMaster - TCG Price Intelligence & Collection Management',
    template: '%s | TCGMaster',
  },
  description:
    'Search card prices, compare graded comps where source-backed data exists, and manage One Piece and Dragon Ball collection values.',
  keywords: [
    'TCG',
    'trading cards',
    'One Piece cards',
    'Dragon Ball cards',
    'price guide',
    'PSA',
    'BGS',
    'card grading',
    'collection management',
    'card prices',
  ],
  authors: [{ name: 'TCGMaster' }],
  creator: 'TCGMaster',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://tcgmaster.com',
    siteName: 'TCGMaster',
    title: 'TCGMaster - TCG Price Intelligence & Collection Management',
    description:
      'Track One Piece and Dragon Ball cards with real-time pricing, graded card data, and portfolio tools.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TCGMaster - TCG Price Intelligence',
    description: 'Search card prices and compare graded comps where source-backed data exists.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {process.env.NEXT_PUBLIC_GTM_ID && (
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
      )}
      <body className={`${inter.variable} ${newsreader.variable} font-sans antialiased bg-[#060c18] text-zinc-100`}>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
