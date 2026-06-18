import { Metadata, Viewport } from 'next';
import { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION } from '@/shared/config/seo';
import { sheetService } from '@/features/sheets/server';
import SheetsClient from './client';
import { GetSheetsParams } from '@/features/sheets/types/sheets.types';

// Force dynamic rendering (no static caching for this page)
export const dynamic = 'force-dynamic';

const OG_IMAGE_URL = `${SITE_URL}/images/logos/og-sheets.png`;

export async function generateMetadata(): Promise<Metadata> {
  const canonicalUrl = `${SITE_URL}/sheets`;

  return {
    title: `Coding Sheets · ${SITE_NAME} – Curated Problem Sets for DSA Practice`,
    description:
      'Discover curated coding sheets created by the developer community. Find the perfect practice set for interviews, contests, or mastering specific topics. Create your own sheet and share it with others.',
    keywords: [
      'coding sheets',
      'problem sets',
      'DSA practice',
      'curated problems',
      'interview prep sheets',
      'DevRhythm sheets',
      'leetcode sheets',
      'coding practice lists',
      'algorithm sheets',
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
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Coding Sheets · ${SITE_NAME}`,
      description: DEFAULT_DESCRIPTION,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_US',
      images: [
        {
          url: OG_IMAGE_URL,
          width: 1200,
          height: 630,
          alt: 'DevRhythm Sheets – Curated coding problem sets',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Coding Sheets · ${SITE_NAME}`,
      description: DEFAULT_DESCRIPTION,
      images: [OG_IMAGE_URL],
      site: '@devrhythm',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Schema generation
const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Sheets', item: `${SITE_URL}/sheets` },
  ],
};

const webpageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: `Coding Sheets · ${SITE_NAME}`,
  description:
    'Discover curated coding sheets created by the developer community. Find the perfect practice set for interviews, contests, or mastering specific topics.',
  url: `${SITE_URL}/sheets`,
  isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/sheets?search={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
  mainEntity: {
    '@type': 'ItemList',
    name: 'Coding Sheets',
    description: 'List of curated coding problem sets',
    numberOfItems: 0,
    itemListElement: [],
  },
};

// Fetch initial sheets data on the server
async function getInitialSheets() {
  const defaultParams: GetSheetsParams = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };
  try {
    const result = await sheetService.getSheets(defaultParams);
    return {
      sheets: result.sheets,
      pagination: result.pagination,
    };
  } catch (error) {
    console.error('Failed to fetch initial sheets:', error);
    return {
      sheets: [],
      pagination: null,
    };
  }
}

export default async function SheetsPage() {
  let initialData;
  try {
    initialData = await getInitialSheets();
  } catch (error) {
    console.error('Failed to fetch initial sheets for page:', error);
    initialData = { sheets: [], pagination: null };
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webpageSchema) }}
      />
      <SheetsClient initialData={initialData} />
    </>
  );
}