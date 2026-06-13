import { NextResponse } from 'next/server';
import { SITE_URL } from '@/shared/config/seo';

const FULL_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'https://api.devrhythm.space';
const API_ORIGIN = FULL_API_BASE.replace(/\/api\/v1\/?$/, '');
const PER_PAGE = 45; // Max URLs per sitemap file

interface ApiResponse {
  meta?: {
    pagination?: {
      total: number;
    };
  };
}

async function getTotalQuestions(): Promise<number> {
  try {
    const url = `${API_ORIGIN}/api/v1/questions?page=1&limit=1`;
    const res = await fetch(url, {
      headers: { 'x-internal-request': 'true' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 0;
    const json: ApiResponse = await res.json();
    return json.meta?.pagination?.total || 0;
  } catch (error) {
    console.error('[Questions Sitemap Index] Failed to fetch total count:', error);
    return 0;
  }
}

export async function GET() {
  const total = await getTotalQuestions();
  const now = new Date().toISOString();

  if (total === 0) {
    // No questions – return empty sitemap index
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
    <loc>${SITE_URL}/sitemap.xml/questions/page/${i}</loc>
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