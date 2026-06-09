import { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Link from 'next/link';
import { Suspense } from 'react';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { ROUTES } from '@/shared/config/routes';
import RevisionDashboardClient from './parts/RevisionDashboardClient';
import { RevisionDashboardSkeleton } from './parts/RevisionDashboardSkeleton';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';
const OG_IMAGE_URL = `${APP_URL}/images/logos/og-revisions.png`;

export const metadata: Metadata = {
  title: 'Revision Dashboard · DevRhythm – Track Your Spaced Repetition Progress',
  description:
    'Monitor your revision progress across all questions. View revision stages, rhythm graphs, confidence trends, and actionable items to master coding patterns with spaced repetition.',
  keywords: [
    'revision dashboard',
    'spaced repetition',
    'coding revision',
    'DSA revision',
    'revision tracking',
    'DevRhythm revisions',
    'coding patterns revision',
    'algorithm revision',
    'forgetting curve',
    'repetition schedule',
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
    canonical: `${APP_URL}/revisions`,
  },
  openGraph: {
    title: 'Revision Dashboard · DevRhythm',
    description:
      'Track your revision progress across all questions. View revision stages, rhythm graphs, and actionable items to master coding patterns.',
    type: 'website',
    url: `${APP_URL}/revisions`,
    siteName: 'DevRhythm',
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: 'DevRhythm Revision Dashboard – Master patterns with spaced repetition',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Revision Dashboard · DevRhythm',
    description:
      'Track your revision progress across all questions. View revision stages, rhythm graphs, and actionable items to master coding patterns.',
    images: [OG_IMAGE_URL],
    site: '@devrhythm',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const breadcrumbItems = [
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Revision' },
];

const generateBreadcrumbSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: breadcrumbItems.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.label,
    ...(item.href && { item: `${APP_URL}${item.href}` }),
  })),
});

const generateWebPageSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${APP_URL}/revisions#webpage`,
  url: `${APP_URL}/revisions`,
  name: 'Revision Dashboard · DevRhythm',
  isPartOf: { '@id': `${APP_URL}/#website` },
  description:
    'Monitor your revision progress across all questions. View revision stages, rhythm graphs, confidence trends, and actionable items to master coding patterns with spaced repetition.',
  primaryImageOfPage: {
    '@type': 'ImageObject',
    url: OG_IMAGE_URL,
  },
});

const generateHowToSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to use the Revision Dashboard',
  description:
    'Step-by-step guide to effectively use the revision dashboard to master coding patterns with spaced repetition.',
  totalTime: 'P30D',
  estimatedCost: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
  supply: [
    { '@type': 'HowToSupply', name: 'DevRhythm account' },
    { '@type': 'HowToSupply', name: 'Solved questions on coding platforms' },
  ],
  tool: [
    { '@type': 'HowToTool', name: 'Revision Dashboard' },
    { '@type': 'HowToTool', name: 'Code editor' },
  ],
  step: [
    {
      '@type': 'HowToStep',
      name: 'Monitor your rhythm',
      text: 'Use the line graphs to track daily revisions, confidence trends, and time spent. Spot patterns in your learning.',
    },
    {
      '@type': 'HowToStep',
      name: 'Check wisdom board',
      text: 'Review difficulty distribution, platform stats, and top patterns to identify strengths and weaknesses.',
    },
    {
      '@type': 'HowToStep',
      name: 'Take action on pending revisions',
      text: 'Practice upcoming revisions or rescue overdue ones by clicking the corresponding buttons. Stay on top of your spaced repetition schedule.',
    },
    {
      '@type': 'HowToStep',
      name: 'Analyze completion rates',
      text: 'Use the funnel and hero stats to see how many revisions you have completed at each stage.',
    },
  ],
});

export default function RevisionPage() {
  const breadcrumbSchema = generateBreadcrumbSchema();
  const webPageSchema = generateWebPageSchema();
  const howToSchema = generateHowToSchema();

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <Script
        id="schema-howto"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <Breadcrumb
        items={breadcrumbItems}
        renderLink={(item, props) => (
          <Link href={item.href!} className={props.className}>
            {props.children}
          </Link>
        )}
      />
      <Suspense fallback={<RevisionDashboardSkeleton />}>
        <RevisionDashboardClient />
      </Suspense>
    </>
  );
}