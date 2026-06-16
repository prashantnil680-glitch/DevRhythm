import { NextResponse } from 'next/server';
import { SITE_URL } from '@/shared/config/seo';

const FULL_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.devrhythm.space/api/v1';
const API_ORIGIN = FULL_API_BASE.replace(/\/api\/v1\/?$/, '');
const PER_PAGE = 100;

interface ApiResponse {
  meta?: {
    pagination?: {
      total: number;
    };
  };
  data?: {
    users?: any[];
    total?: number;
  };
}

async function getTotalUsers(): Promise<number> {
  try {
    const url = `${API_ORIGIN}/api/v1/users?page=1&limit=1`;
    const res = await fetch(url, {
      headers: { 'x-internal-request': 'true' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 0;
    const json = await res.json() as ApiResponse;
    // Try to get total from meta.pagination.total
    if (json.meta?.pagination?.total) {
      return json.meta.pagination.total;
    }
    // Fallback: if data.total exists
    if (json.data?.total && typeof json.data.total === 'number') {
      return json.data.total;
    }
    return 0;
  } catch (error) {
    console.error('[Users Sitemap Index] Failed to fetch total count:', error);
    return 0;
  }
}

export async function GET() {
  const total = await getTotalUsers();
  const now = new Date().toISOString();

  if (total === 0) {
    const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</sitemapindex>`;
    return new NextResponse(emptyXml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  }

  const pages = Math.ceil(total / PER_PAGE);
  const sitemapEntries = [];

  for (let i = 1; i <= pages; i++) {
    sitemapEntries.push(`  <sitemap>
    <loc>${SITE_URL}/sitemap.xml/users/page/${i}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join('\n')}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}