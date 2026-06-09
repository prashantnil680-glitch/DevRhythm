import { MetadataRoute } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://devrhythm.space';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard/',
        '/questions/create',
        '/questions/*/edit',
        '/patterns/*/edit',
        '/goals/create',
        '/groups/create',
        '/shares/create',
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}