import { Suspense } from 'react';
import { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Link from 'next/link';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { QuestionsPageClient } from '@/app/(main)/questions/parts/QuestionsPageClient';
import { ROUTES } from '@/shared/config/routes';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';
const OG_IMAGE = `${SITE_URL}/images/logos/og-questions.png`;

export const metadata: Metadata = {
  title: 'Coding Problems Database · DevRhythm – Practice DSA & Algorithms',
  description:
    'Browse thousands of coding problems from LeetCode, Codeforces, and more. Filter by difficulty, platform, pattern, and tags. Track your solves and mastery.',
  keywords: [
    'coding problems',
    'DSA practice',
    'LeetCode problems',
    'algorithm questions',
    'data structures',
    'coding interview prep',
    'problem solving',
    'DevRhythm questions',
    'programming challenges',
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
    canonical: `${SITE_URL}/questions`,
  },
  openGraph: {
    title: 'Coding Problems Database · DevRhythm',
    description:
      'Browse thousands of coding problems from LeetCode, Codeforces, and more. Filter by difficulty, platform, pattern, and tags.',
    url: `${SITE_URL}/questions`,
    siteName: 'DevRhythm',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'DevRhythm Questions – Practice coding problems',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Coding Problems Database · DevRhythm',
    description:
      'Browse thousands of coding problems from LeetCode, Codeforces, and more. Filter by difficulty, platform, pattern, and tags.',
    images: [OG_IMAGE],
    site: '@devrhythm',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const breadcrumbItems = [
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Questions' },
];

// Generate schema for BreadcrumbList and ItemList
const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
    { '@type': 'ListItem', position: 2, name: 'Questions', item: `${SITE_URL}/questions` },
  ],
};

const searchActionSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: 'DevRhythm',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/questions?search={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

// Note: ItemList schema is dynamically generated on client-side for the actual questions.
// We provide a static placeholder but the client component will update it if needed.
// For now, we include a generic ItemList to satisfy Google's expectations.

export default function QuestionsPage() {
  return (
    <>
      <Script
        id="schema-breadcrumb"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Script
        id="schema-searchaction"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(searchActionSchema) }}
      />
      <Breadcrumb
        items={breadcrumbItems}
        renderLink={(item, props) => (
          <Link href={item.href!} className={props.className}>
            {props.children}
          </Link>
        )}
      />
      <Suspense fallback={<div>Loading questions...</div>}>
        <QuestionsPageClient />
      </Suspense>
    </>
  );
}