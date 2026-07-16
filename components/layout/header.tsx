'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, User, Menu, X, Settings, LogOut, Briefcase, Bell, Trophy, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';

interface NavItem {
  label: string;
  href: string;
}

const mainNavItems: NavItem[] = [
  { label: 'Prices', href: '/search' },
  { label: 'Decks', href: '/decks' },
];

export function Header() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Mock user state
  const user = null;

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
            {user ? (
              <Button variant="ghost" size="icon" className="rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10">
                <Avatar src={null} alt="User" size="sm" />
              </Button>
            ) : (
              <Link href="/login">
                <Button size="sm" className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold tracking-wide shadow-[0_0_15px_rgba(249,115,22,0.4)] border-none px-6">
                  Sign In
                </Button>
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-zinc-300 hover:text-white hover:bg-white/10 rounded-full"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md pt-24 px-6 md:hidden">
          <nav className="flex flex-col gap-4">
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
