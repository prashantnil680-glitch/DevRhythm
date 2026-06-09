export const PUBLIC_PATHS = [
  '/',
  '/login',
  '/auth/callback',
  '/about/me',
  '/privacy',
  '/terms',
  '/users',
  '/sheets',
  '/questions',
  '/patterns',
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}