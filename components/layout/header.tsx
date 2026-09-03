'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Settings, LogOut, Briefcase, Bell, Trophy, FolderOpen, ChevronRight, TrendingUp, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { authClient } from '@/lib/auth-client';
import { CurrencyToggle } from '@/components/ui/currency-toggle';

interface NavItem {
  label: string;
  href: string;
}

const mainNavItems: NavItem[] = [
  { label: 'Prices', href: '/search' },
  { label: 'Decks', href: '/decks' },
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
  const { data: session, isPending: isAuthLoading } = authClient.useSession();
  const user = session?.user ?? null;
  const userMenuToggleRef = React.useRef<HTMLButtonElement>(null);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const mobileMenuToggleRef = React.useRef<HTMLButtonElement>(null);
  const mobileMenuRef = React.useRef<HTMLElement>(null);

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

    const { error } = await authClient.signOut();
    if (error) {
      // Leave the session as-is rather than showing a signed-out header over
      // still-authenticated content.
      console.error('Sign out failed:', error.message);
      return;
    }

    // The session hook updates this client component. Server-rendered
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
            <div className="hidden md:flex items-center gap-3">
              <CurrencyToggle />
              
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
                      src={user.image ?? null}
                      alt={user.name ?? user.email ?? 'User'}
                      fallback={user.name ?? user.email ?? 'User'}
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
            </div>

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
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md pt-20 px-4 md:hidden overflow-y-auto"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          {/* Clean Floating Card Container */}
          <div 
            ref={mobileMenuRef as any}
            className="w-full max-w-sm mx-auto rounded-3xl border border-white/15 bg-[#0b1329]/95 backdrop-blur-xl p-5 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Navigation Section */}
            <div className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Navigation</p>
              
              <Link
                href="/search"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between px-3.5 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-orange-500/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-105 transition-transform">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-base font-bold text-white group-hover:text-orange-400 transition-colors">Prices</span>
                    <p className="text-[11px] text-zinc-400">Search 50,000+ cards & market sales</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
              </Link>

              <Link
                href="/decks"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between px-3.5 py-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-orange-500/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">Decks</span>
                    <p className="text-[11px] text-zinc-400">Tournament decklists & meta tiers</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
              </Link>
            </div>

            {/* Divider */}
            <div className="h-px bg-white/10" />

            {/* Currency & User Actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-zinc-400">Currency</span>
                <CurrencyToggle />
              </div>

              {!isAuthLoading && (
                user ? (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <div className="px-2 text-xs text-zinc-400 truncate">Signed in as <strong className="text-white">{user.email}</strong></div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {userMenuItems.slice(0, 4).map((item) => {
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
                          >
                            <Icon className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleSignOut();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-300 hover:bg-red-500/20 transition-all mt-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <Link 
                    href="/login" 
                    onClick={() => setIsMobileMenuOpen(false)} 
                    className="block w-full pt-1"
                  >
                    <Button 
                      size="lg" 
                      className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold tracking-wide shadow-[0_0_20px_rgba(249,115,22,0.4)] border-none py-3"
                    >
                      Sign In
                    </Button>
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
