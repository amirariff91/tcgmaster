'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get('redirectTo');
  const redirectTo = requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//')
    ? requestedRedirect
    : '/collection';

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    if (error) {
      setError(error.message || 'Unable to sign in');
      setIsLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: redirectTo,
    });

    if (error) {
      setError(error.message || 'Unable to sign in with Google');
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
    });

    if (error) {
      setError(error.message || 'Unable to send a magic link');
      setIsLoading(false);
      return;
    }

    setMessage('Check your email for a magic link to sign in!');
    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-md relative z-10 bg-[#0b1329]/80 backdrop-blur-xl border-white/10 shadow-2xl">
      <CardHeader className="text-center pb-8">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 shadow-inner">
           <span className="text-orange-500 font-black text-3xl italic tracking-tighter" style={{ fontFamily: 'Impact, sans-serif' }}>
             TM
           </span>
        </div>
        <CardTitle className="text-3xl font-bold text-white tracking-tight">Welcome back</CardTitle>
        <CardDescription className="text-zinc-400 text-base mt-2">
          Sign in to your TCGMaster account
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600">
            {message}
          </div>
        )}

        <Button
          variant="outline"
          className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white transition-all"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-transparent px-2 text-zinc-500 font-medium tracking-wider">
              Or continue with email
            </span>
          </div>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-orange-500/50 focus-visible:border-orange-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={handleMagicLink}
                disabled={isLoading}
              >
                Use magic link instead
              </Button>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-orange-500/50 focus-visible:border-orange-500"
            />
          </div>

          <Button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold tracking-wide shadow-[0_0_15px_rgba(249,115,22,0.4)] border-none" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-4">
        <p className="text-center text-sm text-zinc-400">
          Don&apos;t have an account?{' '}
          <Link
            href={`/signup?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="font-semibold text-orange-400 hover:text-orange-300 transition-colors"
          >
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#060c18] relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-600/15 rounded-full blur-[150px] pointer-events-none" />
      
      <React.Suspense fallback={
        <Card className="w-full max-w-md relative z-10 bg-[#0b1329]/80 backdrop-blur-xl border-white/10 shadow-2xl">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-2xl font-bold text-white">Welcome back</CardTitle>
            <CardDescription className="text-zinc-400">Loading...</CardDescription>
          </CardHeader>
        </Card>
      }>
        <LoginForm />
      </React.Suspense>
    </div>
  );
}
