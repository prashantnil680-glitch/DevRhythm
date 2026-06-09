import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION } from '@/shared/config/seo';
import CommunityPage from '@/app/(main)/user/parts/community/CommunityPage';

const OG_IMAGE_URL = `${SITE_URL}/images/og-community.png`;

export const metadata: Metadata = {
  title: `Developer Community · ${SITE_NAME} – Connect with Coders`,
  description: `Discover and connect with fellow developers. See who's solving problems, track progress, compare streaks, and find your coding rhythm together.`,
  keywords: [
    'developer community',
    'coding community',
    'programmers',
    'coding buddies',
    'DevRhythm community',
    'DSA learners',
    'leetcode community',
    'coding friends',
    'developer network',
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
    canonical: `${SITE_URL}/users`,
  },
  openGraph: {
    title: `Developer Community · ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    url: `${SITE_URL}/users`,
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: 'DevRhythm Community – Connect with fellow coders',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Developer Community · ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE_URL],
    site: '@devrhythm',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Enhanced schemas
const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Community', item: `${SITE_URL}/users` },
  ],
};

const webpageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: `Developer Community · ${SITE_NAME}`,
  description: DEFAULT_DESCRIPTION,
  url: `${SITE_URL}/users`,
  isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/users?search={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
  mainEntity: {
    '@type': 'CollectionPage',
    name: 'Developer Community',
    description: 'Browse and connect with developers solving coding problems.',
    hasPart: {
      '@type': 'ItemList',
      itemListElement: [], // Will be populated client‑side; placeholder is acceptable.
    },
  },
};

export default function UsersPage() {
  return (
    <>
      <Script
        id="schema-breadcrumb"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Script
        id="schema-webpage"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webpageSchema) }}
      />
      <CommunityPage />
    </>
  );
}