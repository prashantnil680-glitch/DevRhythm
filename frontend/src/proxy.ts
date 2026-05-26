import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard', '/user/u/'];
const authRoutes = ['/login'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  // Authenticated user trying to access login → redirect to dashboard
  if (token && authRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Unauthenticated user trying to access protected route → redirect to login
  if (!token && protectedRoutes.some(route => pathname.startsWith(route))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For all other matched routes (should not happen with matcher below), let through
  return NextResponse.next();
}

// ✅ Only run the proxy on these exact route patterns
export const config = {
  matcher: ['/dashboard/:path*', '/user/u/:path*', '/login'],
};