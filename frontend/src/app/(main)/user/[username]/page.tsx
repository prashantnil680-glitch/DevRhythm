import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import Script from 'next/script';
import { userServiceServer } from '@/features/user/services/userServiceServer';
import { heatmapServiceServer } from '@/features/heatmap/services/heatmapServiceServer';
import { studyGroupService } from '@/features/studyGroup/services/studyGroupService';
import { patternMasteryService } from '@/features/patternMastery/services/patternMasteryService';
import { userStatsService } from '@/features/user/services/userStatsService';
import { UserPageWrapper } from '@/features/user/components';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION, OG_IMAGE } from '@/shared/config/seo';
import NotFoundPage from '@/shared/components/NotFoundPage';
import type { GroupListResponse } from '@/features/studyGroup/types/studyGroup.types';
import type { PatternMasteryListResponse } from '@/features/patternMastery/types/patternMastery.types';
import { getCurrentUser } from '@/features/auth/server/getCurrentUser';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Helper to generate enhanced Person schema
function generatePersonSchema(user: any, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${canonicalUrl}#person`,
    name: user.displayName || user.username,
    alternateName: `@${user.username}`,
    description: `Solved ${user.stats?.totalSolved || 0} coding problems with a ${user.streak?.current || 0} day streak and ${user.stats?.masteryRate || 0}% mastery rate.`,
    image: user.avatarUrl || OG_IMAGE,
    url: canonicalUrl,
    sameAs: [
      user.githubUrl,
      user.linkedinUrl,
      user.leetcodeUrl,
      user.portfolioUrl,
    ].filter(Boolean),
    knowsAbout: ['Data Structures & Algorithms', 'Coding', 'Problem Solving'],
    jobTitle: 'Developer',
    mainEntityOfPage: {
      '@type': 'ProfilePage',
      '@id': canonicalUrl,
    },
  };
}

// Helper to generate BreadcrumbList schema
function generateBreadcrumbSchema(user: any, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Users', item: `${SITE_URL}/users` },
      { '@type': 'ListItem', position: 3, name: user.displayName || user.username, item: canonicalUrl },
    ],
  };
}

// Helper to generate ProfilePage schema
function generateProfilePageSchema(user: any, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': canonicalUrl,
    url: canonicalUrl,
    name: `${user.displayName || user.username} · Coding Profile`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: { '@id': `${canonicalUrl}#person` },
    dateCreated: user.createdAt,
    dateModified: user.updatedAt,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  try {
    const user = await userServiceServer.getUserByUsername(username);
    if (!user?._id || !user.username) {
      throw new Error('User not found');
    }
    const displayName = user.displayName || user.username;
    const totalSolved = user.stats?.totalSolved ?? 0;
    const streak = user.streak?.current ?? 0;
    const mastery = user.stats?.masteryRate ?? 0;
    const title = `${displayName} (@${user.username}) · Coding Profile · ${SITE_NAME}`;
    const description = `Solved ${totalSolved} problems · 🔥 ${streak} day streak · 📈 ${mastery}% mastery. View their progress, heatmap, and solved questions on DevRhythm.`;
    const keywords = [
      displayName,
      user.username,
      'coding profile',
      'developer progress',
      'problem solving',
      'DSA',
      'coding stats',
      'programming journey',
    ].join(', ');
    const canonicalUrl = `${SITE_URL}/user/${username}`;

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
        siteName: SITE_NAME,
        images: user.avatarUrl ? [{ url: user.avatarUrl, alt: displayName }] : [{ url: OG_IMAGE, alt: SITE_NAME }],
        type: 'profile',
        username: user.username,
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: user.avatarUrl ? [user.avatarUrl] : [OG_IMAGE],
        site: '@devrhythm',
      },
    };
  } catch (error) {
    console.error(`Metadata fetch failed for ${username}:`, error);
    return {
      title: 'User Not Found',
      description: DEFAULT_DESCRIPTION,
      robots: 'noindex, nofollow',
    };
  }
}

export default async function PublicUserPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  try {
    const user = await userServiceServer.getUserByUsername(username);
    if (!user?._id) {
      throw new Error('User not found');
    }

    // ✅ Redirect logged-in users from their own public profile to their private profile
    const currentUser = await getCurrentUser();
    if (currentUser && currentUser.username === user.username) {
      redirect(`/user/u/${user.username}`);
    }

    // ✅ Redirect to canonical username if case/format differs
    if (user.username !== username) {
      redirect(`/user/${user.username}`);
    }

    const userId = user._id;
    const currentYear = new Date().getFullYear();

    const [
      heatmapResult,
      progressResult,
      groupsResult,
      patternsResult,
      statsResult,
    ] = await Promise.allSettled([
      heatmapServiceServer.getPublicUserHeatmap(userId, currentYear),
      userServiceServer.getUserPublicProgress(userId, { limit: 6 }),
      studyGroupService.getUserPublicGroups(userId, { limit: 5 }),
      patternMasteryService.getUserPatternMastery(userId, { limit: 4 }),
      userStatsService.getPublicUserStats(userId),
    ]);

    const initialHeatmap = heatmapResult.status === 'fulfilled' ? heatmapResult.value : null;
    const initialProgress = progressResult.status === 'fulfilled' ? progressResult.value : [];
    const initialGroups = groupsResult.status === 'fulfilled' ? groupsResult.value as GroupListResponse : null;
    const initialPatterns = patternsResult.status === 'fulfilled' ? (patternsResult.value as PatternMasteryListResponse).patterns : [];
    const initialDetailedStats = statsResult.status === 'fulfilled' ? statsResult.value : null;

    const canonicalUrl = `${SITE_URL}/user/${username}`;
    const personSchema = generatePersonSchema(user, canonicalUrl);
    const breadcrumbSchema = generateBreadcrumbSchema(user, canonicalUrl);
    const profilePageSchema = generateProfilePageSchema(user, canonicalUrl);

    const breadcrumbUiItems = [
      { label: 'Home', href: '/' },
      { label: 'Users', href: '/users' },
      { label: user.displayName || user.username },
    ];

    return (
      <>
        {/* Person Schema */}
        <Script
          id="schema-person"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
        />
        {/* BreadcrumbList Schema */}
        <Script
          id="schema-breadcrumb"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
        {/* ProfilePage Schema */}
        <Script
          id="schema-profilepage"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(profilePageSchema) }}
        />
        <Breadcrumb items={breadcrumbUiItems} />
        <UserPageWrapper
          user={user}
          isOwnProfile={false}
          initialHeatmap={initialHeatmap}
          initialProgress={initialProgress}
          initialGroups={initialGroups}
          initialPatterns={initialPatterns}
          initialDetailedStats={initialDetailedStats}
        />
      </>
    );
  } catch (error: any) {
    // ✅ If the error is a redirect, rethrow it so Next.js can handle it
    if (error?.digest?.startsWith?.('NEXT_REDIRECT')) {
      throw error;
    }
    console.error(`Failed to load user ${username}:`, error);
    return (
      <NotFoundPage
        title="User Not Found"
        message="The user you're looking for doesn't exist or their profile is private."
        actionHref="/users"
        actionText="Search User"
      />
    );
  }
}