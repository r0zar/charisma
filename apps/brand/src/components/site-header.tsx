'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/site';
import { ThemeToggle } from '@repo/brand/react';

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="cx-header sticky top-0 z-20 overflow-x-auto">
      <Link className="cx-lockup" href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logos/charisma-mark.png" alt="" />Charisma <b>Brand</b>
      </Link>
      <nav className="cx-nav">
        {NAV.map(item => (
          <Link key={item.href} href={item.href} aria-current={path === item.href ? 'page' : undefined}>{item.label}</Link>
        ))}
      </nav>
      <ThemeToggle />
    </header>
  );
}
