'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search,
  User,
  Menu,
  X,
  Briefcase,
  Bell,
  Trophy,
  ChevronDown,
  LogOut,
  Settings,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/search/search-bar';
import { Avatar } from '@/components/ui/avatar';
import { CurrencyToggle } from '@/components/ui/currency-toggle';

interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

const mainNavItems: NavItem[] = [
  { label: 'Pokemon', href: '/pokemon' },
  { label: 'Basketball', href: '/sports-basketball' },
  { label: 'Baseball', href: '/sports-baseball' },
];

const userNavItems: NavItem[] = [
  { label: 'My Collection', href: '/collection', icon: <FolderOpen className="h-4 w-4" /> },
  { label: 'Portfolio', href: '/portfolio', icon: <Briefcase className="h-4 w-4" /> },
  { label: 'Price Alerts', href: '/alerts', icon: <Bell className="h-4 w-4" /> },
  { label: 'Achievements', href: '/achievements', icon: <Trophy className="h-4 w-4" /> },
];

export function Header() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // Mock user state - replace with actual auth
  const user = null; // { id: '1', email: 'user@example.com', display_name: 'Collector' };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
            <span className="text-lg font-bold text-white">T</span>
          </div>
          <span className="hidden text-xl font-bold text-zinc-900 sm:block">
            TCGMaster
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          {mainNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-zinc-900',
                pathname.startsWith(item.href)
                  ? 'text-zinc-900'
                  : 'text-zinc-500'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          {/* Desktop Search */}
          <div className="hidden w-80 lg:block">
            <SearchBar size="sm" placeholder="Search cards..." />
          </div>

          {/* Mobile Search Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Currency Toggle */}
          <CurrencyToggle className="hidden sm:block" />

          {/* Cert Lookup */}
          <Link href="/cert">
            <Button variant="outline" size="sm" className="hidden sm:flex">
              Cert Lookup
            </Button>
          </Link>

          {/* User Menu */}
          {user ? (
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 rounded-lg p-2 hover:bg-zinc-100"
              >
                <Avatar src={null} alt="User" size="sm" />
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-200 bg-white py-2 shadow-xl">
                  <div className="border-b border-zinc-200 px-4 py-2">
                    <p className="font-medium text-zinc-900">
                      {user}
                    </p>
                    <p className="text-sm text-zinc-500">{user}</p>
                  </div>

                  {userNavItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}

                  <div className="border-t border-zinc-200 pt-2">
                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        // Sign out logic
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth/login">
              <Button size="sm">
                <User className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Search */}
      {isSearchOpen && (
        <div className="border-t border-zinc-200 p-4 lg:hidden">
          <SearchBar size="sm" autoFocus />
        </div>
      )}

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="border-t border-zinc-200 md:hidden">
          <nav className="container py-4">
            <div className="space-y-1">
              {mainNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'block rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    pathname.startsWith(item.href)
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'text-zinc-600 hover:bg-zinc-50'
                  )}
                >
                  {item.label}
                </Link>
              ))}

              <div className="border-t border-zinc-200 pt-2">
                <Link
                  href="/cert"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cert Lookup
                </Link>
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
