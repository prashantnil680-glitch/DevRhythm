import { Metadata } from 'next';
import { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION } from '@/shared/config/seo';
import { sheetService } from '@/features/sheets/server';
import SheetsClient from './client';
import { GetSheetsParams } from '@/features/sheets/types/sheets.types';

// Force dynamic rendering (no static caching for this page)
export const dynamic = 'force-dynamic';

// Generate metadata for SEO
export async function generateMetadata(): Promise<Metadata> {
  const canonicalUrl = `${SITE_URL}/sheets`;

  return {
    title: `Sheets · ${SITE_NAME}`,
    description: `Browse and discover curated question sheets created by the DevRhythm community. Find the perfect practice set for your learning goals.`,
    keywords: ['coding sheets', 'problem sets', 'DSA', 'practice questions', 'DevRhythm'],
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Sheets · ${SITE_NAME}`,
      description: DEFAULT_DESCRIPTION,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Sheets · ${SITE_NAME}`,
      description: DEFAULT_DESCRIPTION,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

// Fetch initial sheets data on the server
async function getInitialSheets() {
  const defaultParams: GetSheetsParams = {
    page: 1,
    limit: 10,
    sortBy: 'bookmarkCount',
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
  const initialData = await getInitialSheets();

  return <SheetsClient initialData={initialData} />;
}