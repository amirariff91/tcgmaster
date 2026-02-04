import Link from 'next/link';
import { cn } from '@/lib/utils';

const footerLinks = {
  categories: {
    title: 'Categories',
    links: [
      { label: 'Pokemon', href: '/pokemon' },
      { label: 'Basketball', href: '/sports-basketball' },
      { label: 'Baseball', href: '/sports-baseball' },
    ],
  },
  tools: {
    title: 'Tools',
    links: [
      { label: 'Market Movers', href: '/market' },
      { label: 'Cert Lookup', href: '/cert' },
      { label: 'Price Alerts', href: '/alerts' },
      { label: 'Portfolio', href: '/portfolio' },
    ],
  },
  company: {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
};

export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'border-t border-zinc-200 bg-zinc-50',
        className
      )}
    >
      <div className="container-footer py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
                <span className="text-lg font-bold text-white">T</span>
              </div>
              <span className="text-xl font-bold text-zinc-900">
                TCGMaster
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-zinc-500">
              The ultimate TCG price intelligence and collection management platform for serious
              collectors and investors.
            </p>
          </div>

          {/* Links */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-zinc-900">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-zinc-200 pt-8 sm:flex-row">
          <p className="text-sm text-zinc-500">
            &copy; {new Date().getFullYear()} TCGMaster. All rights reserved.
          </p>
          <p className="text-sm text-zinc-400">
            Prices are for reference only. Always verify before purchasing.
          </p>
        </div>
      </div>
    </footer>
  );
}
