import Link from 'next/link';
import { ThemeToggle } from '@repo/brand/react';
import { TokenSearch } from './token-search';

const NAV = [
  { href: '/', label: 'Markets' },
  { href: '/docs', label: 'API' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-chrome text-on-chrome">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 md:gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/charisma.png" alt="" className="h-7 w-7 rounded-full" />
          <span className="hidden text-[17px] font-bold tracking-tight sm:inline">
            Charisma <span className="text-chrome-accent">Prices</span>
          </span>
        </Link>
        <TokenSearch />
        <nav aria-label="Primary" className="ml-auto flex items-center gap-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-on-chrome-muted transition-colors hover:bg-on-chrome/10 hover:text-on-chrome">
              {label}
            </Link>
          ))}
          <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-chrome-muted transition-colors hover:bg-on-chrome/10 hover:text-on-chrome" />
        </nav>
      </div>
    </header>
  );
}
