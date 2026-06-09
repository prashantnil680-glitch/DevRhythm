import { MetadataRoute } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        // Authentication & private user areas
        '/api/',
        '/dashboard',
        '/dashboard/',
        '/activity',
        '/activity/',
        '/goals',
        '/goals/',
        '/goals/create',
        '/goals/*/edit',
        '/notifications',
        '/notifications/',
        '/revisions',
        '/revisions/',
        // Question management (authenticated)
        '/questions/create',
        '/questions/*/edit',
        // '/questions/deleted',
        // Pattern management
        '/patterns/*/edit',
        // Sheet management (private)
        '/sheets/create',
        '/sheets/*/edit',
        '/sheets/*/progress/*', // progress pages are public? Actually they are public (user progress) but we can keep them – they should be indexed. Remove if you want them indexed.
        // Goal management
        '/goals/create',
        '/goals/*/edit',
        // Groups (placeholder, not ready)
        '/groups',
        '/groups/',
        '/groups/*',
        // Shares (coming soon)
        // '/shares',
        // '/shares/',
        '/shares/*',
        // Heatmap (private)
        '/heatmap',
        '/heatmap/',
        '/leaderboard', // placeholder
        '/leaderboard/',
        '/progress', // private
        '/progress/',
        // Search users (private? it's not built)
        '/users',
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}