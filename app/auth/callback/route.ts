import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const safeRedirect = (r: string | null) => {
    if (!r || !r.startsWith('/') || r.startsWith('//')) return '/collection';
    return r;
  };
  const redirectTo = safeRedirect(searchParams.get('redirectTo'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // User provisioning is handled by the database trigger on auth.users.
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }

    console.error('[auth/callback] Failed to exchange auth code for session:', error);
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
