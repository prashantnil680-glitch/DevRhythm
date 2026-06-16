import { NextResponse } from 'next/server';
import { SITE_URL } from '@/shared/config/seo';

const FULL_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ||
                      'https://api.devrhythm.space/api/v1';
const API_ORIGIN = FULL_API_BASE.replace(/\/api\/v1\/?$/, '');
const PER_PAGE = 100;

export const dynamic = 'force-dynamic';

interface Question {
  platformQuestionId: string;
  updatedAt: string;
}

interface ApiResponse {
  data?: {
    questions?: Question[];
  };
}

async function fetchQuestionsPage(page: number): Promise<Question[]> {
  const url = `${API_ORIGIN}/api/v1/questions?page=${page}&limit=${PER_PAGE}&sortBy=updatedAt&sortOrder=desc`;

  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-internal-request': 'true',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`[Questions Sitemap] HTTP ${res.status} for page ${page}`);
      return [];
    }
    const json: ApiResponse = await res.json();
    const questions = json.data?.questions || [];
    // Filter out any without a platformQuestionId
    return questions.filter(q => q?.platformQuestionId);
  } catch (err) {
    console.error(`[Questions Sitemap] Error fetching page ${page}:`, err);
    return [];
  }
}

function generateSitemapXml(questions: Question[]): string {
  const now = new Date().toISOString();
  const urlElements = questions.map(q => `
    <url>
      <loc>${SITE_URL}/questions/${q.platformQuestionId}</loc>
      <lastmod>${q.updatedAt || now}</lastmod>
      <changefreq>weekly</changefreq>
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
  try {
    const { page: pageStr } = await params;
    const page = parseInt(pageStr, 10);

    if (isNaN(page) || page < 1) {
      return new NextResponse('Invalid page number', { status: 400 });
    }

    const questions = await fetchQuestionsPage(page);
    const xml = generateSitemapXml(questions);
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error(`[Questions Sitemap] Failed to generate sitemap for page:`, error);
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