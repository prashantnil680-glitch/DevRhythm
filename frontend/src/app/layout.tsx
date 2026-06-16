import type { Metadata } from 'next';
import { Commissioner, Outfit, Patrick_Hand } from 'next/font/google';
import { RootLayoutClient } from '@/providers/RootLayoutClient';
import '@/shared/styles/globals.css';

const commissioner = Commissioner({
  subsets: ['latin'],
  variable: '--font-commissioner',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const patrickHand = Patrick_Hand({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-patrick-hand',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DevRhythm',
  description: 'Track your coding journey',
  metadataBase: new URL('https://www.devrhythm.space'),
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://api.devrhythm.space/api/v1';

  return (
    <html
      lang="en"
      className={`${commissioner.variable} ${outfit.variable} ${patrickHand.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="author" content="Anupam Debnath" />
        <link rel="author" href="/about/me" />
        <link rel="icon" href="/images/logos/dr-icon-dark-logo.png" type="image/png" />

        {/* Preconnect to API domain for faster data fetching */}
        {apiUrl && (
          <>
            <link rel="preconnect" href={apiUrl} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={apiUrl} />
          </>
        )}

        {/* Preconnect to avatar CDN domains to speed up image loading */}
        <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
        <link rel="preconnect" href="https://avatars.githubusercontent.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://avatars.githubusercontent.com" />

        {/* Preconnect to Cloudinary if used */}
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}