import { NextResponse } from 'next/server';
import { SITE_URL } from '@/shared/config/seo';

const FULL_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'https://api.devrhythm.space';
const API_ORIGIN = FULL_API_BASE.replace(/\/api\/v1\/?$/, '');
const PER_PAGE = 50; // Consistent with index

interface Sheet {
  slug: string;
  updatedAt: string;
}

interface FlexibleResponse {
  success?: boolean;
  data?: any;
  sheets?: Sheet[];
  meta?: any;
}

async function fetchSheetsPage(page: number): Promise<Sheet[]> {
  const url = `${API_ORIGIN}/api/v1/sheets?page=${page}&limit=${PER_PAGE}&sortBy=updatedAt&sortOrder=desc`;
  console.log(`[Sheets Sitemap] Fetching page ${page}: ${url}`);
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
    const json: FlexibleResponse = await res.json();
    console.log(`[Sheets Sitemap] Response keys: ${Object.keys(json)}`);

    // Try multiple possible data paths
    let sheets: Sheet[] = [];
    if (json.data?.sheets && Array.isArray(json.data.sheets)) {
      sheets = json.data.sheets;
    } else if (json.sheets && Array.isArray(json.sheets)) {
      sheets = json.sheets;
    } else if (json.data && Array.isArray(json.data)) {
      sheets = json.data;
    } else if (Array.isArray(json)) {
      sheets = json;
    } else {
      console.error(`[Sheets Sitemap] Unexpected structure:`, JSON.stringify(json).slice(0, 200));
      return [];
    }

    // Ensure each sheet has a slug
    const validSheets = sheets.filter(s => s && s.slug);
    console.log(`[Sheets Sitemap] Fetched ${validSheets.length} valid sheets for page ${page}`);
    return validSheets;
  } catch (err) {
    console.error(`[Sheets Sitemap] Error fetching page ${page}:`, err);
    return [];
  }
}

function generateSitemapXml(sheets: Sheet[]): string {
  const now = new Date().toISOString();

  if (sheets.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
  }

  const urlElements = sheets.map((sheet) => {
    const lastmod = sheet.updatedAt || now;
    return `
  <url>
    <loc>${SITE_URL}/sheets/${sheet.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
  }).join('');

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