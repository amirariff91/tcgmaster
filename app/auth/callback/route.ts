import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = searchParams.get('redirectTo') || '/collection';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user profile exists, create if not
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!existingUser) {
          // Create user profile with founding collector flag
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('users') as any).insert({
            id: user.id,
            email: user.email!,
            display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
            avatar_url: user.user_metadata?.avatar_url,
            is_founding_collector: true, // Early adopters get this badge
          });

          // Create default collection
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('collections') as any).insert({
            user_id: user.id,
            name: 'My Collection',
            type: 'personal',
            is_public: false,
          });
        }
      }

      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
