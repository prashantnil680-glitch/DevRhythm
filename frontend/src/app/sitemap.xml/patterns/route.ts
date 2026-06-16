import { NextResponse } from 'next/server';
import { SITE_URL } from '@/shared/config/seo';
import { slugify } from '@/shared/lib/stringUtils';

const FULL_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ||
                      'https://api.devrhythm.space/api/v1';
const API_ORIGIN = FULL_API_BASE.replace(/\/api\/v1\/?$/, '');

// Prevent static generation – always fetch fresh data
export const dynamic = 'force-dynamic';

interface ApiResponse {
  data?: {
    patterns?: string[];
  };
}

async function fetchAllPatterns(): Promise<Array<{ name: string; slug: string; lastmod: string }>> {
  try {
    const url = `${API_ORIGIN}/api/v1/questions/patterns`;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-internal-request': 'true',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.error(`[Patterns Sitemap] Failed to fetch patterns: ${res.status}`);
      return [];
    }

    const json: ApiResponse = await res.json();
    const patterns = json.data?.patterns || [];
    const now = new Date().toISOString();

    // Filter out empty or invalid pattern names and ensure slug is generated
    return patterns
      .filter(name => name && name.trim().length > 0)
      .map(name => ({
        name,
        slug: slugify(name),
        lastmod: now,
      }))
      .filter(p => p.slug && p.slug.length > 0);
  } catch (error) {
    console.error('[Patterns Sitemap] Error fetching patterns:', error);
    return [];
  }
}

function generatePatternsSitemapXml(patterns: Array<{ name: string; slug: string; lastmod: string }>): string {
  const now = new Date().toISOString();
  const urlElements = patterns.map(p => `
    <url>
      <loc>${SITE_URL}/patterns/${p.slug}</loc>
      <lastmod>${p.lastmod || now}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.6</priority>
    </url>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlElements}
</urlset>`;
}

export async function GET() {
  try {
    const patterns = await fetchAllPatterns();
    const xml = generatePatternsSitemapXml(patterns);
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('[Patterns Sitemap] Unexpected error:', error);
    // Return an empty sitemap on error to avoid HTML fallback
    const emptyXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
    return new NextResponse(emptyXml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  }
}