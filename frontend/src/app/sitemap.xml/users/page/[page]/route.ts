import { NextResponse } from 'next/server';
import { SITE_URL } from '@/shared/config/seo';

const FULL_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.devrhythm.space/api/v1';
const API_ORIGIN = FULL_API_BASE.replace(/\/api\/v1\/?$/, '');
const PER_PAGE = 100;

interface User {
  username: string;
  updatedAt?: string;
}

interface FlexibleResponse {
  success?: boolean;
  data?: any;
  users?: User[];
  meta?: any;
}

async function fetchUsersPage(page: number): Promise<User[]> {
  const url = `${API_ORIGIN}/api/v1/users?page=${page}&limit=${PER_PAGE}&sortBy=createdAt&sortOrder=desc`;
  console.log(`[Users Sitemap] Fetching page ${page}: ${url}`);
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', 'x-internal-request': 'true' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`[Users Sitemap] HTTP ${res.status} for page ${page}`);
      return [];
    }
    const json: FlexibleResponse = await res.json();
    console.log(`[Users Sitemap] Response keys: ${Object.keys(json)}`);

    // Try multiple possible data paths
    let users: User[] = [];
    if (json.data?.users && Array.isArray(json.data.users)) {
      users = json.data.users;
    } else if (json.users && Array.isArray(json.users)) {
      users = json.users;
    } else if (json.data && Array.isArray(json.data)) {
      users = json.data;
    } else if (Array.isArray(json)) {
      users = json;
    } else {
      console.error(`[Users Sitemap] Unexpected structure:`, JSON.stringify(json).slice(0, 200));
      return [];
    }

    // Ensure each user has a username
    const validUsers = users.filter(u => u && u.username);
    console.log(`[Users Sitemap] Fetched ${validUsers.length} valid users for page ${page}`);
    return validUsers;
  } catch (err) {
    console.error(`[Users Sitemap] Error fetching page ${page}:`, err);
    return [];
  }
}

function generateSitemapXml(users: User[]): string {
  const now = new Date().toISOString();

  if (users.length === 0) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;
  }

  const urlElements = users.map((user) => {
    const lastmod = user.updatedAt || now;
    return `
  <url>
    <loc>${SITE_URL}/user/${user.username}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
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
    const users = await fetchUsersPage(page);
    const xml = generateSitemapXml(users);
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error(`[Users Sitemap] Failed to generate sitemap for page ${page}:`, error);
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