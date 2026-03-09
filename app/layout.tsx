import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Providers } from './providers';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'TCGMaster - TCG Price Intelligence & Collection Management',
    template: '%s | TCGMaster',
  },
  description:
    'The ultimate TCG price intelligence and collection management platform. Track Pokemon, sports cards, and more with real-time pricing, graded card data, and portfolio tools.',
  keywords: [
    'TCG',
    'trading cards',
    'Pokemon cards',
    'sports cards',
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
      'Track Pokemon, sports cards, and more with real-time pricing, graded card data, and portfolio tools.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TCGMaster - TCG Price Intelligence',
    description: 'The ultimate TCG price intelligence and collection management platform.',
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{page_path:window.location.pathname});`}
            </Script>
          </>
        )}
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-white text-zinc-900`}>
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
