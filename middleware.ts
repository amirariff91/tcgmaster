import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  /*
   * Only the routes that actually need a session: the gated pages `updateSession`
   * redirects, plus the auth flow itself (where the token refresh must run).
   *
   * The previous catch-all matched every public catalog page too, so every card,
   * set, and search view paid a `supabase.auth.getUser()` round-trip and could not
   * be served from the edge cache.
   */
  matcher: [
    '/collection/:path*',
    '/portfolio/:path*',
    '/alerts/:path*',
    '/achievements/:path*',
    '/settings/:path*',
    '/login',
    '/signup',
    '/auth/:path*',
  ],
};
