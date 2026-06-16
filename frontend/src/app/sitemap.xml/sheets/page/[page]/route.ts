import { NextResponse } from 'next/server';
import { SITE_URL } from '@/shared/config/seo';

const FULL_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL  || 'https://api.devrhythm.space/api/v1';
const API_ORIGIN = FULL_API_BASE.replace(/\/api\/v1\/?$/, '');
const PER_PAGE = 15;

interface Sheet {
  slug: string;
  updatedAt: string;
}

interface ApiResponse {
  data?: Sheet[];
  meta?: any;
}

async function fetchSheetsPage(page: number): Promise<Sheet[]> {
  const url = `${API_ORIGIN}/api/v1/sheets?page=${page}&limit=${PER_PAGE}&sortBy=updatedAt&sortOrder=desc`;

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', 'x-internal-request': 'true' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[Sheets Sitemap] HTTP ${res.status} for page ${page}`);
      return [];
    }

    const json: ApiResponse = await res.json();
    const sheets = json.data || [];

    // Filter out entries without a slug
    const validSheets = sheets.filter(s => s?.slug);
    console.log(`[Sheets Sitemap] Fetched ${validSheets.length} valid sheets for page ${page}`);
    return validSheets;
  } catch (err) {
    console.error(`[Sheets Sitemap] Error fetching page ${page}:`, err);
    return [];
  }
}

function generateSitemapXml(sheets: Sheet[]): string {
  const now = new Date().toISOString();
  const urlElements = sheets.map(sheet => `
    <url>
      <loc>${SITE_URL}/sheets/${sheet.slug}</loc>
      <lastmod>${sheet.updatedAt || now}</lastmod>
      <changefreq>daily</changefreq>
      <priority>0.7</priority>
    </url>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlElements}
</urlset>`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ page: string }> }
) {
  const { page: pageStr } = await params;
  const page = parseInt(pageStr, 10);

  if (isNaN(page) || page < 1) {
    return new NextResponse('Invalid page number', { status: 400 });
  }

  try {
    const sheets = await fetchSheetsPage(page);
    const xml = generateSitemapXml(sheets);
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error(`[Sheets Sitemap] Failed to generate sitemap for page ${page}:`, error);
    // Return empty sitemap on error to avoid breaking the sitemap index
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