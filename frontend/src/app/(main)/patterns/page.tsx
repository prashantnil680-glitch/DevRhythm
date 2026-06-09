import { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { ROUTES } from '@/shared/config/routes';
import PatternsDashboardClient from './parts/PatternsDashboardClient';
import { PatternDashboardSkeleton } from './parts/PatternDashboardSkeleton';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';
const OG_IMAGE_URL = `${APP_URL}/images/logos/main-logo.png`;

export const metadata: Metadata = {
  title: 'Pattern Mastery Dashboard · DevRhythm',
  description:
    'Track your progress across coding patterns. View strongest/weakest patterns, mastery rates, and recent solved questions.',
  keywords:
    'coding patterns, problem solving, mastery tracking, DSA patterns, LeetCode patterns, coding progress, DevRhythm',
  authors: [{ name: 'DevRhythm Team', url: APP_URL }],
  robots: 'index, follow',
  alternates: {
    canonical: `${APP_URL}/patterns`,
  },
  openGraph: {
    title: 'Pattern Mastery Dashboard · DevRhythm',
    description:
      'Track your progress across coding patterns. View strongest/weakest patterns, mastery rates, and recent solved questions.',
    type: 'website',
    url: `${APP_URL}/patterns`,
    images: [
      {
        url: OG_IMAGE_URL,
        width: 512,
        height: 512,
        alt: 'DevRhythm Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pattern Mastery Dashboard · DevRhythm',
    description:
      'Track your progress across coding patterns. View strongest/weakest patterns, mastery rates, and recent solved questions.',
    images: [OG_IMAGE_URL],
  },
};

const breadcrumbItems = [
  { label: 'Home', href: ROUTES.HOME },
  { label: 'Patterns' },
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

const generateHowToSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to master coding patterns',
  description:
    'Step-by-step guide to improving your pattern mastery using the DevRhythm dashboard.',
  totalTime: 'P30D',
  estimatedCost: { '@type': 'MonetaryAmount', value: 0, currency: 'USD' },
  supply: [
    { '@type': 'HowToSupply', name: 'DevRhythm account' },
    { '@type': 'HowToSupply', name: 'Coding platform account (LeetCode, Codeforces, etc.)' },
  ],
  tool: [
    { '@type': 'HowToTool', name: 'Pattern Mastery Dashboard' },
    { '@type': 'HowToTool', name: 'Code editor' },
  ],
  step: [
    {
      '@type': 'HowToStep',
      name: 'Solve problems regularly',
      text: 'Solve at least one problem per day. The dashboard tracks your solved count.',
      image: OG_IMAGE_URL,
    },
    {
      '@type': 'HowToStep',
      name: 'Review your strongest and weakest patterns',
      text: 'Check the hero cards to identify which patterns you excel at and which need improvement.',
    },
    {
      '@type': 'HowToStep',
      name: 'Focus on weak patterns',
      text: 'Click on a weak pattern to see related questions and practice more.',
    },
    {
      '@type': 'HowToStep',
      name: 'Track mastery progress',
      text: 'Monitor mastery percentage and confidence levels for each pattern in the list.',
    },
    {
      '@type': 'HowToStep',
      name: 'Use revision reminders',
      text: 'Set up revision schedules to reinforce learned patterns over time.',
    },
  ],
});

export default async function PatternsPage() {
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
      <Suspense fallback={<PatternDashboardSkeleton />}>
        <PatternsDashboardClient />
      </Suspense>
    </>
  );
}