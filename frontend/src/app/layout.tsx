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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      </head>
      <body>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}