import { NextResponse } from 'next/server';
import { SITE_URL } from '@/shared/config/seo';

const FULL_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ||
                      'https://api.devrhythm.space/api/v1';
const API_ORIGIN = FULL_API_BASE.replace(/\/api\/v1\/?$/, '');
const PER_PAGE = 15;

// Prevent static generation – always fetch fresh data
export const dynamic = 'force-dynamic';

interface ApiResponse {
  meta?: {
    pagination?: {
      total: number;
    };
  };
}

async function getTotalSheets(): Promise<number> {
  try {
    const url = `${API_ORIGIN}/api/v1/sheets?page=1&limit=1`;
    const res = await fetch(url, {
      headers: { 'x-internal-request': 'true' },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 0;
    const json: ApiResponse = await res.json();
    return json.meta?.pagination?.total || 0;
  } catch {
    return 0; // On any fetch error, treat as no sheets
  }
}

function generateEmptySitemapIndex(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</sitemapindex>`;
}

export async function GET() {
  try {
    const total = await getTotalSheets();
    const now = new Date().toISOString();

    if (total === 0) {
      const xml = generateEmptySitemapIndex();
      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        },
      });
    }

    const pages = Math.ceil(total / PER_PAGE);
    const entries = [];
    for (let i = 1; i <= pages; i++) {
      entries.push(`
    <sitemap>
      <loc>${SITE_URL}/sitemap.xml/sheets/page/${i}</loc>
      <lastmod>${now}</lastmod>
    </sitemap>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}
</sitemapindex>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('[Sheets Sitemap Index] Unexpected error:', error);
    // Return an empty sitemap index on any error to avoid HTML error pages
    const xml = generateEmptySitemapIndex();
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  }
}