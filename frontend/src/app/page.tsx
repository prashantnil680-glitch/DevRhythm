// src/app/page.tsx

import { Metadata } from 'next';
import Script from 'next/script';
import HomePageClient from './HomePageClient';

const SITE_URL = 'https://www.devrhythm.space';
const OG_IMAGE = `${SITE_URL}/images/dr-logo.png`;
const LOGO_URL = `${SITE_URL}/images/logos/dr-icon-light-logo.png`;

// Replace with actual demo video details
const DEMO_VIDEO_ID = 'H46vC6Qp67U';
const DEMO_THUMBNAIL_URL = `${SITE_URL}/images/demo-thumbnail.jpg`;
const DEMO_VIDEO_URL = `https://www.youtube.com/watch?v=${DEMO_VIDEO_ID}`;
const DEMO_EMBED_URL = `https://www.youtube.com/embed/${DEMO_VIDEO_ID}`;

export const metadata: Metadata = {
  title: 'DevRhythm – Build Your Coding Rhythm | DSA Practice Platform',
  description:
    'Master Data Structures & Algorithms with spaced repetition, heatmaps, and smart revision schedules. Build lasting coding habits and track your progress.',
  keywords: [
    'coding practice',
    'DSA',
    'LeetCode',
    'spaced repetition',
    'coding habits',
    'programming',
    'algorithms',
    'data structures',
    'coding rhythm',
    'problem solving',
    'developer tools',
  ].join(', '),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: 'DevRhythm – Build Your Coding Rhythm',
    description:
      'Master DSA with rhythm, not cramming. Spaced repetition, heatmaps, and smart revision schedules.',
    url: SITE_URL,
    siteName: 'DevRhythm',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'DevRhythm – Code with rhythm, track your progress',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevRhythm – Build Your Coding Rhythm',
    description: 'Master DSA with rhythm, not cramming.',
    images: [OG_IMAGE],
    site: '@devrhythm',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
  category: 'technology',
};

export default function HomePage() {
  return (
    <>
      {/* Organization Schema for Google Logo */}
      <Script
        id="schema-organization"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'DevRhythm',
            url: SITE_URL,
            logo: LOGO_URL,
            sameAs: [
              'https://github.com/anupam6335/DevRhythm',
              'https://twitter.com/devrhythm',
            ],
          }),
        }}
      />

      {/* VideoObject Schema for demo video */}
      <Script
        id="schema-video"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'VideoObject',
            name: 'DevRhythm Demo – Build your coding rhythm',
            description: 'Watch how DevRhythm uses spaced repetition, heatmaps, and smart revision schedules to help you master DSA with consistent practice.',
            thumbnailUrl: DEMO_THUMBNAIL_URL,
            uploadDate: new Date().toISOString().split('T')[0],
            duration: 'PT3M45S', // Replace with actual duration
            contentUrl: DEMO_VIDEO_URL,
            embedUrl: DEMO_EMBED_URL,
            interactionStatistic: {
              '@type': 'InteractionCounter',
              interactionType: 'https://schema.org/WatchAction',
              userInteractionCount: 0, // Will be updated by YouTube; placeholder
            },
          }),
        }}
      />

      <HomePageClient />
    </>
  );
}