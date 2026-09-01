import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  // Protected routes
  const protectedPaths = ['/collection', '/portfolio', '/alerts', '/achievements', '/settings', '/admin'];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  /*
   * Only the routes that actually need a session: the gated pages `updateSession`
   * redirects, plus the auth flow itself (where Better Auth handles callbacks).
   *
   * The previous catch-all matched every public catalog page too, so every card,
   * set, and search view paid an auth session round-trip and could not
   * be served from the edge cache.
   */
  matcher: [
    '/collection/:path*',
    '/portfolio/:path*',
    '/alerts/:path*',
    '/achievements/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
    '/auth/:path*',
  ],
};
