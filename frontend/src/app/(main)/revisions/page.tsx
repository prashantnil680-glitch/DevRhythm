import { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { ROUTES } from '@/shared/config/routes';
import RevisionDashboardClient from './parts/RevisionDashboardClient';
import { RevisionDashboardSkeleton } from './parts/RevisionDashboardSkeleton';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.com';

export const metadata: Metadata = {
  title: 'Revision Dashboard · DevRhythm',
  description: 'Track your revision progress across all questions. View revision stages, rhythm graphs, and actionable items to master coding patterns.',
  keywords: 'revision dashboard, spaced repetition, coding practice, revision tracking, DevRhythm, coding patterns, DSA revision',
  authors: [{ name: 'DevRhythm Team', url: APP_URL }],
  robots: 'index, follow',
  alternates: {
    canonical: `${APP_URL}/revisions`,
  },
  openGraph: {
    title: 'Revision Dashboard · DevRhythm',
    description: 'Track your revision progress across all questions. View revision stages, rhythm graphs, and actionable items to master coding patterns.',
    type: 'website',
    url: `${APP_URL}/revisions`,
    images: [
      {
        url: `${APP_URL}/images/logos/main-logo.png`,
        width: 512,
        height: 512,
        alt: 'DevRhythm Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Revision Dashboard · DevRhythm',
    description: 'Track your revision progress across all questions. View revision stages, rhythm graphs, and actionable items to master coding patterns.',
    images: [`${APP_URL}/images/logos/main-logo.png`],
  },
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

const generateHowToSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to use the Revision Dashboard',
  description: 'Step-by-step guide to effectively use the revision dashboard to master coding patterns.',
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
    // {
    //   '@type': 'HowToStep',
    //   name: 'Review your revision funnel',
    //   text: 'Check the pillar graph to see how many questions are at each revision stage (1st to 5th review).',
    // },
    {
      '@type': 'HowToStep',
      name: 'Monitor your rhythm',
      text: 'Use the line graphs to track daily revisions, confidence trends, and time spent.',
    },
    {
      '@type': 'HowToStep',
      name: 'Check wisdom board',
      text: 'Review difficulty distribution, platform stats, and top patterns to identify strengths and weaknesses.',
    },
    {
      '@type': 'HowToStep',
      name: 'Take action',
      text: 'Practice upcoming revisions or rescue overdue ones by clicking the corresponding buttons.',
    },
  ],
});

export default function RevisionPage() {
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
      <Suspense fallback={<RevisionDashboardSkeleton />}>
        <RevisionDashboardClient />
      </Suspense>
    </>
  );
}