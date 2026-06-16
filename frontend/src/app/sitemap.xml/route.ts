import { NextResponse } from 'next/server';
import { SITE_URL } from '@/shared/config/seo';

// Get the full API base URL from env (includes /api/v1)
const FULL_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.devrhythm.space/api/v1';
// Remove trailing /api/v1 to get the origin
const API_ORIGIN = FULL_API_BASE.replace(/\/api\/v1\/?$/, '');

// Helper to check if an entity type has any public items
async function hasItems(endpoint: string): Promise<boolean> {
  try {
    const url = `${API_ORIGIN}/api/v1${endpoint}?page=1&limit=1`;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-internal-request': 'true',
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.meta?.pagination?.total) return json.meta.pagination.total > 0;
    if (json.data?.total) return json.data.total > 0;
    if (Array.isArray(json.data?.questions)) return json.data.questions.length > 0;
    if (Array.isArray(json.data?.sheets)) return json.data.sheets.length > 0;
    if (Array.isArray(json.data?.patterns)) return json.data.patterns.length > 0;
    if (Array.isArray(json.data?.users)) return json.data.users.length > 0;
    return false;
  } catch {
    return false;
  }
}

export async function GET() {
  const now = new Date().toISOString();

  const sitemapEntries: { loc: string; lastmod?: string }[] = [
    { loc: `${SITE_URL}/sitemap.xml/static` },
  ];

  // Check each type
  if (await hasItems('/questions')) sitemapEntries.push({ loc: `${SITE_URL}/sitemap.xml/questions` });
  if (await hasItems('/questions/patterns')) sitemapEntries.push({ loc: `${SITE_URL}/sitemap.xml/patterns` });
  if (await hasItems('/sheets')) sitemapEntries.push({ loc: `${SITE_URL}/sitemap.xml/sheets` });
  if (await hasItems('/users')) sitemapEntries.push({ loc: `${SITE_URL}/sitemap.xml/users` });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(entry => `  <sitemap>
    <loc>${entry.loc}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}