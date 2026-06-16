export const PUBLIC_PATHS = [
  '/',
  '/login',
  '/auth/callback',
  '/about/me',
  '/privacy',
  '/groups/my',
  '/terms',
  '/users',
  '/sheets',
  '/questions',
  '/patterns',
  '/sitemap.xml', // Allows all subpaths: /sitemap.xml/sheets, /sitemap.xml/questions, etc.
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}