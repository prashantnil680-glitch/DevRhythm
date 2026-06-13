import { NextResponse } from 'next/server';
import { SITE_URL } from '@/shared/config/seo';
import { slugify } from '@/shared/lib/stringUtils';

const FULL_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'https://api.devrhythm.space';
const API_ORIGIN = FULL_API_BASE.replace(/\/api\/v1\/?$/, '');

interface ApiResponse {
  data?: {
    patterns?: string[];
  };
}

async function fetchAllPatterns(): Promise<Array<{ name: string; slug: string; lastmod: string }>> {
  const url = `${API_ORIGIN}/api/v1/questions/patterns`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-internal-request': 'true',
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    console.error(`Failed to fetch patterns: ${res.status}`);
    return [];
  }

  const json: ApiResponse = await res.json();
  const patterns = json.data?.patterns || [];

  const now = new Date().toISOString();

  return patterns.map((patternName) => ({
    name: patternName,
    slug: slugify(patternName),
    lastmod: now,
  }));
}

function generatePatternsSitemapXml(patterns: Array<{ name: string; slug: string; lastmod: string }>): string {
  if (patterns.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
  }

  const urlElements = patterns.map((p) => `
  <url>
    <loc>${SITE_URL}/patterns/${p.slug}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`).join('');

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
    console.error('Failed to generate patterns sitemap:', error);
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