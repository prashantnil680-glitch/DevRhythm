import { Metadata, Viewport } from 'next';
import Script from 'next/script';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { ROUTES } from '@/shared/config';
import { sheetService } from '@/features/sheets/server';
import { userServiceServer } from '@/features/user/services/userServiceServer';
import UserProgressPageClient from './UserProgressPageClient';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/logos/og-progress.png`;

interface PageProps {
  params: Promise<{ slug: string; username: string }>;
}

// Fetch sheet data
async function getSheetMetadata(slug: string) {
  try {
    const response = await sheetService.getSheetBySlug(slug);
    const result = response as any;
    if (!result?.success || !result.data?.sheet) return null;
    return result.data.sheet;
  } catch (error) {
    console.error(`Failed to fetch sheet metadata for slug: ${slug}`, error);
    return null;
  }
}

// Fetch user metadata with optional token
async function getUserMetadata(username: string, token?: string) {
  try {
    const user = await userServiceServer.getUserByUsername(username, token);
    if (!user?._id) return null;
    return user;
  } catch (error) {
    console.error(`Failed to fetch user metadata for username: ${username}`, error);
    return null;
  }
}

// Fetch user progress summary (optional, used for metadata)
async function getUserProgressSummary(slug: string, username: string, token?: string) {
  try {
    // sheetService.getUserProgress may not accept a token, but we can pass it if the server service supports it.
    // Currently, the server service does not support token, so we skip it.
    // If needed, we could extend sheetService to accept a token.
    const response = await sheetService.getUserProgress(slug, username, { limit: 1 });
    return response;
  } catch (error) {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, username } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  const [sheet, user] = await Promise.all([
    getSheetMetadata(slug),
    getUserMetadata(username, token),
  ]);

  if (!sheet || !user) {
    return {
      title: 'Progress Not Found | DevRhythm',
      description: 'The requested user progress could not be found.',
      robots: 'noindex, nofollow',
    };
  }

  // Fetch progress summary for metadata (optional, fallback to default stats)
  const progress = await getUserProgressSummary(slug, username, token);
  const solvedCount = progress?.stats?.solvedCount ?? 0;
  const totalQuestions = sheet.totalQuestions ?? 0;
  const percentComplete = totalQuestions > 0 ? Math.round((solvedCount / totalQuestions) * 100) : 0;

  const displayName = user.displayName || user.username;
  const title = `${displayName} · Progress on "${sheet.name}" | DevRhythm`;
  const description = `${displayName} has solved ${solvedCount}/${totalQuestions} questions (${percentComplete}%) in the "${sheet.name}" coding sheet. View their progress, revision status, and more.`;
  const keywords = [
    sheet.name,
    username,
    'coding progress',
    'sheet progress',
    'DevRhythm progress',
    'coding sheet',
  ].filter(Boolean).join(', ');
  const canonicalUrl = `${SITE_URL}/sheets/${slug}/progress/${username}`;

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
          url: user.avatarUrl || DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: `${displayName}'s progress on ${sheet.name}`,
        },
      ],
      locale: 'en_US',
      type: 'profile',
      username: user.username,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [user.avatarUrl || DEFAULT_OG_IMAGE],
      site: '@devrhythm',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Generate structured data
async function generateSchemas(slug: string, username: string, token?: string) {
  const [sheet, user] = await Promise.all([
    getSheetMetadata(slug),
    getUserMetadata(username, token),
  ]);
  if (!sheet || !user) return null;

  const canonicalUrl = `${SITE_URL}/sheets/${slug}/progress/${username}`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Sheets', item: `${SITE_URL}/sheets` },
      { '@type': 'ListItem', position: 3, name: sheet.name, item: `${SITE_URL}/sheets/${slug}` },
      { '@type': 'ListItem', position: 4, name: user.displayName || user.username, item: canonicalUrl },
    ],
  };

  const profilePageSchema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': canonicalUrl,
    url: canonicalUrl,
    name: `${user.displayName || user.username} · Progress on ${sheet.name}`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: {
      '@type': 'Person',
      name: user.displayName || user.username,
      alternateName: `@${user.username}`,
      image: user.avatarUrl,
      url: `${SITE_URL}/user/${user.username}`,
    },
  };

  return { breadcrumbSchema, profilePageSchema };
}

export default async function UserProgressPage({ params }: PageProps) {
  const { slug, username } = await params;

  // Check authentication
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const isAuthenticated = !!token;

  const sheet = await getSheetMetadata(slug);
  const user = await getUserMetadata(username, token);
  const schemas = await generateSchemas(slug, username, token);

  if (!sheet || !user) {
    notFound();
  }

  // ===== RESTORED BREADCRUMB =====
  const breadcrumbItems = [
    { label: 'Home', href: ROUTES.DASHBOARD },
    { label: 'Sheets', href: ROUTES.SHEETS.ROOT },
    { label: 'Sheet', href: `${ROUTES.SHEETS.DETAIL(slug)}` },
    { label: `Progress of ${username}` },
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
            id="schema-profilepage"
            type="application/ld+json"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas.profilePageSchema) }}
          />
        </>
      )}
      <Breadcrumb items={breadcrumbItems} renderLink={renderLink} />
      <UserProgressPageClient requiresAuth={!isAuthenticated} />
    </>
  );
}