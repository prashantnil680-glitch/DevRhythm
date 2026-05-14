import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Script from 'next/script';
import { userServiceServer } from '@/features/user/services/userServiceServer';
import { heatmapServiceServer } from '@/features/heatmap/services/heatmapServiceServer';
import { studyGroupService } from '@/features/studyGroup/services/studyGroupService';
import { patternMasteryService } from '@/features/patternMastery/services/patternMasteryService';
import { userStatsService } from '@/features/user/services/userStatsService';
import { UserPageWrapper } from '@/features/user/components';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION } from '@/shared/config/seo';
import NotFoundPage from '@/shared/components/NotFoundPage';
import type { GroupListResponse } from '@/features/studyGroup/types/studyGroup.types';
import type { PatternMasteryListResponse } from '@/features/patternMastery/types/patternMastery.types';
import { getCurrentUser } from '@/features/auth/server/getCurrentUser';


// Helper to generate Person schema
function generatePersonSchema(user: any, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: user.displayName || user.username,
    alternateName: `@${user.username}`,
    description: `Solved ${user.stats.totalSolved} coding problems with a ${user.streak.current} day streak and ${user.stats.masteryRate}% mastery rate.`,
    image: user.avatarUrl || undefined,
    url: canonicalUrl,
    mainEntityOfPage: {
      '@type': 'ProfilePage',
      '@id': canonicalUrl,
    },
  };
}

// Helper to generate BreadcrumbList schema
function generateBreadcrumbSchema(items: { name: string; item?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.item && { item: item.item }),
    })),
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
    const title = `${displayName} (@${user.username}) · Coding Profile · ${SITE_NAME}`;
    const description = `Solved ${user.stats?.totalSolved ?? 0} problems · 🔥 ${user.streak?.current ?? 0} day streak · 📈 ${user.stats?.masteryRate ?? 0}% mastery. View their progress, heatmap, and solved questions.`;

    return {
      title,
      description,
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
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/user/${username}`,
        siteName: SITE_NAME,
        images: user.avatarUrl ? [{ url: user.avatarUrl, alt: displayName }] : [],
        type: 'profile',
        username: user.username,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: user.avatarUrl ? [user.avatarUrl] : [],
      },
      alternates: {
        canonical: `${SITE_URL}/user/${username}`,
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
      redirect(`/user/u/${user.username}`);
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
    const breadcrumbItemsForSchema = [
      { name: 'Home', item: SITE_URL },
      { name: 'Users', item: `${SITE_URL}/users` },
      { name: user.displayName || user.username },
    ];
    const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItemsForSchema);
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