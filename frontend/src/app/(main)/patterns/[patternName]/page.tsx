import { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Link from 'next/link';
import { cookies } from 'next/headers';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { ROUTES } from '@/shared/config/routes';
import PatternDetailsClient from './parts/PatternDetailsClient';
import { slugToPatternName } from '@/shared/lib';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';
const OG_IMAGE = `${SITE_URL}/images/logos/og-patterns.png`;

interface PageProps {
  params: Promise<{ patternName: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { patternName: slug } = await params;
  const originalName = slugToPatternName(decodeURIComponent(slug));
  const canonicalUrl = `${SITE_URL}/patterns/${slug}`;

  return {
    title: `${originalName} Pattern Mastery · DevRhythm – Track Your Progress`,
    description: `Master the ${originalName} coding pattern. View your solved questions, mastery rate, confidence level, and suggested problems to practice. Improve your DSA skills with spaced repetition.`,
    keywords: [
      originalName,
      'coding pattern',
      'DSA pattern',
      'algorithm pattern',
      'pattern mastery',
      'coding practice',
      'DevRhythm patterns',
      `${originalName} problems`,
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
      title: `${originalName} Pattern Mastery · DevRhythm`,
      description: `Master the ${originalName} coding pattern. Track solved questions, mastery rate, and suggested problems.`,
      url: canonicalUrl,
      siteName: 'DevRhythm',
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${originalName} Pattern Mastery` }],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${originalName} Pattern Mastery · DevRhythm`,
      description: `Master the ${originalName} coding pattern. Track your progress and practice.`,
      images: [OG_IMAGE],
      site: '@devrhythm',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Generate schemas
function generateSchemas(patternName: string, slug: string) {
  const canonicalUrl = `${SITE_URL}/patterns/${slug}`;
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Patterns', item: `${SITE_URL}/patterns` },
      { '@type': 'ListItem', position: 3, name: patternName, item: canonicalUrl },
    ],
  };
  const webpageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: `${patternName} Pattern Mastery · DevRhythm`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    description: `Master the ${patternName} coding pattern. View solved questions, mastery rate, confidence level, and suggested problems.`,
    primaryImageOfPage: { '@type': 'ImageObject', url: OG_IMAGE },
  };
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Suggested ${patternName} Questions`,
    description: `Coding problems to practice the ${patternName} pattern.`,
    numberOfItems: 0,
    itemListElement: [],
  };
  return { breadcrumbSchema, webpageSchema, itemListSchema };
}

export default async function PatternDetailPage({ params }: PageProps) {
  const { patternName: slug } = await params;
  const originalName = slugToPatternName(decodeURIComponent(slug));

  // Check authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const isAuthenticated = !!token;

  const { breadcrumbSchema, webpageSchema, itemListSchema } = generateSchemas(originalName, slug);

  const breadcrumbItems = [
    { label: 'Home', href: ROUTES.HOME },
    { label: 'Patterns', href: '/patterns' },
    { label: originalName },
  ];

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
      <Script
        id="schema-itemlist"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <Breadcrumb
        items={breadcrumbItems}
        renderLink={(item, props) => (
          <Link href={item.href!} className={props.className}>
            {props.children}
          </Link>
        )}
      />
      <PatternDetailsClient patternName={originalName} requiresAuth={!isAuthenticated} />
    </>
  );
}