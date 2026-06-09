import { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { GoalDashboardSkeleton } from './parts/GoalDashboardSkeleton';
import GoalDashboardClient from './parts/GoalDashboardClient';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { ROUTES } from '@/shared/config';
import Link from 'next/link';
import GoalDashboardDataProvider from './GoalDashboardDataProvider';


const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';

export const metadata: Metadata = {
  title: 'Goal Tracker & Coding Progress Dashboard | DevRhythm',
  description:
    'Set daily and weekly coding goals, track your completion trends, plan question sets, and master DSA patterns. Stay consistent with smart goal reminders and performance analytics.',
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
  ].join(', '),
  authors: [{ name: 'DevRhythm Team', url: APP_URL }],
  robots: 'index, follow',
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
        url: `${APP_URL}/images/logos/og-goals.png`,
        width: 1200,
        height: 630,
        alt: 'DevRhythm Goals Dashboard – Track your coding progress',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Goal Tracker & Coding Progress Dashboard | DevRhythm',
    description:
      'Set daily and weekly coding goals, track completion trends, and manage planned question sets. Visualise your momentum with river‑style timelines and smart analytics.',
    images: [`${APP_URL}/images/logos/og-goals.png`],
    site: '@devrhythm',
  },
  category: 'productivity',
};

// Separate viewport export (Next.js 15)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

const breadcrumbItems = [
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Goals' },
];

// Structured data: BreadcrumbList + HowTo for goal setting
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
  const howToSchema = generateHowToSchema();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
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