import { NextResponse } from 'next/server';
import { SITE_URL } from '@/shared/config/seo';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || SITE_URL || 'https://www.devrhythm.space';

function generateSitemapXml(): string {
  const currentDate = new Date().toISOString();

  const urls = [
    { loc: `${APP_URL}`, lastmod: currentDate, changefreq: 'daily', priority: 1.0 },
    { loc: `${APP_URL}/about/me`, lastmod: currentDate, changefreq: 'monthly', priority: 0.8 },
    { loc: `${APP_URL}/privacy`, lastmod: currentDate, changefreq: 'yearly', priority: 0.3 },
    { loc: `${APP_URL}/terms`, lastmod: currentDate, changefreq: 'yearly', priority: 0.3 },
    { loc: `${APP_URL}/questions`, lastmod: currentDate, changefreq: 'daily', priority: 0.9 },
    { loc: `${APP_URL}/patterns`, lastmod: currentDate, changefreq: 'weekly', priority: 0.8 },
    { loc: `${APP_URL}/sheets`, lastmod: currentDate, changefreq: 'daily', priority: 0.8 },
    { loc: `${APP_URL}/users`, lastmod: currentDate, changefreq: 'daily', priority: 0.7 },
  ];

  const urlElements = urls
    .map(
      (url) => `
  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlElements}
</urlset>`;
}

export async function GET() {
  const xml = generateSitemapXml();
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}