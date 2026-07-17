'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Settings, LogOut, Briefcase, Bell, Trophy, FolderOpen } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/browser';

interface NavItem {
  label: string;
  href: string;
}

const mainNavItems: NavItem[] = [
  { label: 'Prices', href: '/search' },
  { label: 'Decks', href: '/decks' },
  { label: 'Pokémon', href: '/pokemon' },
];

const userMenuItems = [
  { label: 'Collection', href: '/collection', icon: FolderOpen },
  { label: 'Portfolio', href: '/portfolio', icon: Briefcase },
  { label: 'Alerts', href: '/alerts', icon: Bell },
  { label: 'Achievements', href: '/achievements', icon: Trophy },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [user, setUser] = React.useState<SupabaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);
  const supabase = React.useMemo(() => createClient(), []);
  const userMenuToggleRef = React.useRef<HTMLButtonElement>(null);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const mobileMenuToggleRef = React.useRef<HTMLButtonElement>(null);
  const mobileMenuRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    let isMounted = true;
    let authStateChanged = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authStateChanged = true;

      if (!isMounted) return;

      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    const loadUser = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!isMounted || authStateChanged) return;

        setUser(currentUser);
      } finally {
        if (isMounted && !authStateChanged) {
          setIsAuthLoading(false);
        }
      }
    };

    void loadUser();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  React.useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleOutsidePointerDown = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (userMenuRef.current?.contains(target) || userMenuToggleRef.current?.contains(target)) {
        return;
      }

      setIsUserMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      setIsUserMenuOpen(false);
      userMenuToggleRef.current?.focus();
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    document.addEventListener('mousedown', handleOutsidePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
      document.removeEventListener('mousedown', handleOutsidePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  React.useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleOutsidePointerDown = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (mobileMenuRef.current?.contains(target) || mobileMenuToggleRef.current?.contains(target)) {
        return;
      }

      setIsMobileMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      setIsMobileMenuOpen(false);
      mobileMenuToggleRef.current?.focus();
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    document.addEventListener('mousedown', handleOutsidePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
      document.removeEventListener('mousedown', handleOutsidePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);

    const { error } = await supabase.auth.signOut();
    if (error) {
      // Leave the session as-is rather than showing a signed-out header over
      // still-authenticated content.
      console.error('Sign out failed:', error.message);
      return;
    }

    // onAuthStateChange only updates this client component. Server-rendered
    // content (e.g. /settings) keeps rendering the old session until the route
    // is revalidated; refreshing also lets middleware bounce gated pages.
    router.refresh();
  };

  return (
    <>
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-3xl rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl transition-all duration-300">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6 relative">
          
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 select-none group">
              <span className="text-orange-500 font-black text-2xl italic tracking-tighter transition-transform group-hover:scale-105" style={{ fontFamily: 'Impact, sans-serif' }}>
                 TM
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              {mainNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase transition-all duration-300',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {isAuthLoading ? (
              <div className="h-10 w-10" aria-hidden="true" />
            ) : user ? (
              <div className="relative">
                <Button
                  ref={userMenuToggleRef}
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10"
                  onClick={() => setIsUserMenuOpen((isOpen) => !isOpen)}
                  aria-label={isUserMenuOpen ? 'Close account menu' : 'Open account menu'}
                  aria-expanded={isUserMenuOpen}
                  aria-controls="account-menu"
                >
                  <Avatar
                    src={user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null}
                    alt={user.user_metadata?.full_name ?? user.email ?? 'User'}
                    fallback={user.user_metadata?.full_name ?? user.email ?? 'User'}
                    size="sm"
                  />
                </Button>

                {isUserMenuOpen && (
                  <div
                    ref={userMenuRef}
                    id="account-menu"
                    className="absolute right-0 top-12 w-56 rounded-2xl border border-white/10 bg-[#0b1329]/95 p-2 shadow-2xl backdrop-blur-md"
                  >
                    <div className="border-b border-white/10 px-3 py-2 text-xs text-zinc-400 truncate">
                      {user.email}
                    </div>
                    <div className="py-1">
                      {userMenuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                    <div className="border-t border-white/10 pt-1">
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={handleSignOut}
                        className="w-full justify-start rounded-xl px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white"
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login">
                <Button size="sm" className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold tracking-wide shadow-[0_0_15px_rgba(249,115,22,0.4)] border-none px-6">
                  Sign In
                </Button>
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              ref={mobileMenuToggleRef}
              variant="ghost"
              size="icon"
              className="md:hidden text-zinc-300 hover:text-white hover:bg-white/10 rounded-full"
              type="button"
              onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation-menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          id="mobile-navigation-menu"
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md pt-24 px-6 md:hidden"
        >
          <nav ref={mobileMenuRef} className="flex flex-col gap-4">
            {mainNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-2xl font-bold text-white hover:text-orange-400 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/cert"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-2xl font-bold text-zinc-400 hover:text-white transition-colors mt-4 pt-4 border-t border-white/10"
            >
              Cert Lookup
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
