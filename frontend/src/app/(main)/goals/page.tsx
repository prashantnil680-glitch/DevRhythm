import { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
import { GoalDashboardSkeleton } from './parts/GoalDashboardSkeleton';
import GoalDashboardClient from './parts/GoalDashboardClient';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { ROUTES } from '@/shared/config';
import Link from 'next/link';
import GoalDashboardDataProvider from './GoalDashboardDataProvider';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';
const OG_IMAGE_URL = `${APP_URL}/images/logos/og-goals.png`;

export const metadata: Metadata = {
  title: 'Goal Tracker & Coding Progress Dashboard · DevRhythm – Set, Track, Achieve',
  description:
    'Set daily, weekly, and planned coding goals. Track completion trends, monitor streaks, and master DSA patterns with smart goal reminders and performance analytics. Stay consistent.',
  keywords: [
    'coding goals',
    'daily goal tracker',
    'weekly goal tracker',
    'planned goals',
    'coding progress dashboard',
    'DSA goal setting',
    'DevRhythm goals',
    'programming consistency',
    'leetcode goals',
    'coding streak tracker',
    'goal completion',
    'productivity for developers',
  ].join(', '),
  authors: [{ name: 'DevRhythm Team', url: APP_URL }],
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
    canonical: `${APP_URL}/goals`,
  },
  openGraph: {
    title: 'Goal Tracker & Coding Progress Dashboard | DevRhythm',
    description:
      'Set daily and weekly coding goals, track completion trends, and manage planned question sets. Visualise your momentum with river‑style timelines and smart analytics.',
    type: 'website',
    url: `${APP_URL}/goals`,
    siteName: 'DevRhythm',
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: 'DevRhythm Goals Dashboard – Track your coding progress',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Goal Tracker & Coding Progress Dashboard | DevRhythm',
    description:
      'Set daily and weekly coding goals, track completion trends, and manage planned question sets. Visualise your momentum with river‑style timelines and smart analytics.',
    images: [OG_IMAGE_URL],
    site: '@devrhythm',
  },
  category: 'productivity',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

const breadcrumbItems = [
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Goals' },
];

// Structured data: BreadcrumbList + HowTo + WebPage
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
  '@id': `${APP_URL}/goals#webpage`,
  url: `${APP_URL}/goals`,
  name: 'Goal Tracker & Coding Progress Dashboard | DevRhythm',
  isPartOf: { '@id': `${APP_URL}/#website` },
  description:
    'Set daily and weekly coding goals, track completion trends, and manage planned question sets. Visualise your momentum with river‑style timelines and smart analytics.',
  primaryImageOfPage: {
    '@type': 'ImageObject',
    url: OG_IMAGE_URL,
  },
});

const generateHowToSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to master coding with goal setting',
  description:
    'A step‑by‑step guide to setting effective daily, weekly, and planned goals using DevRhythm’s goal dashboard.',
  totalTime: 'P30D',
  estimatedCost: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
  supply: [
    { '@type': 'HowToSupply', name: 'DevRhythm account' },
    { '@type': 'HowToSupply', name: 'Solved questions on coding platforms' },
  ],
  tool: [
    { '@type': 'HowToTool', name: 'Goal Dashboard' },
    { '@type': 'HowToTool', name: 'Progress charts' },
  ],
  step: [
    {
      '@type': 'HowToStep',
      name: 'Set a daily goal',
      text: 'Choose how many problems you want to solve each day. The dashboard will track your completion and display a progress ring.',
      image: OG_IMAGE_URL,
    },
    {
      '@type': 'HowToStep',
      name: 'Set a weekly goal',
      text: 'Define a weekly target to maintain a consistent rhythm. The dashboard shows your weekly progress alongside the daily goal.',
    },
    {
      '@type': 'HowToStep',
      name: 'Create planned goals',
      text: 'Select specific questions you want to master within a timeframe. Each question is listed in a river‑style timeline, and your progress is tracked automatically.',
    },
    {
      '@type': 'HowToStep',
      name: 'Review your trends',
      text: 'Use the monthly and yearly charts to see how your goal completion compares with the community average.',
    },
    {
      '@type': 'HowToStep',
      name: 'Stay consistent',
      text: 'Monitor your current streak and longest streak. Use the history list to revisit completed or failed goals.',
    },
  ],
});

export default function GoalsPage() {
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
      <GoalDashboardDataProvider>
        <Suspense fallback={<GoalDashboardSkeleton />}>
          <GoalDashboardClient />
        </Suspense>
      </GoalDashboardDataProvider>
    </>
  );
}