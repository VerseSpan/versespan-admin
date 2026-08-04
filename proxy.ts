import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// /admin/control is public: it shows its own inline sign-in (serverless login,
// works when EC2 is off) and its API calls carry a Bearer token.
const PUBLIC_PATHS = ['/login', '/watch', '/join', '/admin/control'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes authenticate themselves (Bearer / their own logic). Never bounce
  // them to the HTML login page — a 307 on /api/admin/login breaks sign-in.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('authToken')?.value;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!token && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in — redirect away from login page only (not from /watch)
  if (token && pathname === '/login') {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
