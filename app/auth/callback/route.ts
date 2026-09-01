import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const safeRedirect = (r: string | null) => {
    if (!r || !r.startsWith('/') || r.startsWith('//')) return '/collection';
    return r;
  };
  const redirectTo = safeRedirect(searchParams.get('redirectTo'));

  // Better Auth completes OAuth and magic-link callbacks inside
  // /api/auth/[...all]. This route remains as a compatibility landing page for
  // old links and only redirects once Better Auth has established the cookie.
  const session = await getAuthSession();
  if (session) {
    return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
