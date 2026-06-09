import { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { ROUTES } from '@/shared/config';
import { sheetService } from '@/features/sheets/server';
import SheetDetailPageClient from './SheetDetailPageClient';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/logos/og-sheets.png`;

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Fetch sheet data on the server – handle the actual API response shape
async function getSheetMetadata(slug: string) {
  try {
    const response = await sheetService.getSheetBySlug(slug);
    // The API returns { success: boolean, data: { sheet, ... } }
    // We cast to any to bypass TypeScript limitations of the current type definition
    const result = response as any;
    if (!result?.success || !result.data?.sheet) {
      return null;
    }
    return result.data.sheet;
  } catch (error) {
    console.error(`Failed to fetch sheet metadata for slug: ${slug}`, error);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sheet = await getSheetMetadata(slug);

  if (!sheet) {
    return {
      title: 'Sheet Not Found | DevRhythm',
      description: 'The requested coding sheet could not be found.',
      robots: 'noindex, nofollow',
    };
  }

  const title = `${sheet.name} · Coding Sheet | DevRhythm`;
  const description = sheet.description
    ? `${sheet.description.substring(0, 160)} ${sheet.specialTag ? `Category: ${sheet.specialTag}.` : ''} ${sheet.totalQuestions} questions.`
    : `A curated coding sheet with ${sheet.totalQuestions} questions. ${sheet.specialTag ? `Category: ${sheet.specialTag}.` : ''} Practice and track your progress.`;
  const keywords = [
    sheet.name,
    sheet.specialTag,
    'coding sheet',
    'problem set',
    'DSA practice',
    'DevRhythm sheets',
    sheet.originalSourceName,
  ].filter(Boolean).join(', ');
  const canonicalUrl = `${SITE_URL}/sheets/${slug}`;

  return {
    title,
    description,
    keywords,
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
      title,
      description,
      url: canonicalUrl,
      siteName: 'DevRhythm',
      images: [
        {
          url: sheet.ogImageUrl || DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: `${sheet.name} – Coding Sheet`,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [sheet.ogImageUrl || DEFAULT_OG_IMAGE],
      site: '@devrhythm',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Generate structured data
async function generateSchemas(slug: string) {
  const sheet = await getSheetMetadata(slug);
  if (!sheet) return null;

  const canonicalUrl = `${SITE_URL}/sheets/${slug}`;
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Sheets', item: `${SITE_URL}/sheets` },
      { '@type': 'ListItem', position: 3, name: sheet.name, item: canonicalUrl },
    ],
  };
  const webpageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: `${sheet.name} · Coding Sheet | DevRhythm`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    description: sheet.description || `A curated coding sheet with ${sheet.totalQuestions} questions.`,
    primaryImageOfPage: { '@type': 'ImageObject', url: sheet.ogImageUrl || DEFAULT_OG_IMAGE },
  };
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Questions in ${sheet.name}`,
    description: `List of coding problems in the ${sheet.name} sheet.`,
    numberOfItems: sheet.totalQuestions || 0,
    itemListElement: [],
  };
  return { breadcrumbSchema, webpageSchema, itemListSchema };
}

export default async function SheetDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const sheet = await getSheetMetadata(slug);
  const schemas = await generateSchemas(slug);

  if (!sheet) {
    notFound();
  }

  const breadcrumbItems = [
    { label: 'Home', href: ROUTES.DASHBOARD },
    { label: 'Sheets', href: ROUTES.SHEETS.ROOT },
    { label: sheet.name },
  ];

  const renderLink = (item: { href?: string }, props: { className: string; children: React.ReactNode }) => {
    if (!item.href) return <span {...props}>{props.children}</span>;
    return <Link href={item.href} className={props.className}>{props.children}</Link>;
  };

  return (
    <>
      {schemas && (
        <>
          <Script
            id="schema-breadcrumb"
            type="application/ld+json"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas.breadcrumbSchema) }}
          />
          <Script
            id="schema-webpage"
            type="application/ld+json"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas.webpageSchema) }}
          />
          <Script
            id="schema-itemlist"
            type="application/ld+json"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas.itemListSchema) }}
          />
        </>
      )}
      <Breadcrumb items={breadcrumbItems} renderLink={renderLink} />
      <SheetDetailPageClient />
    </>
  );
}