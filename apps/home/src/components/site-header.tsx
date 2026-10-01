import { LINKS } from '@/lib/site';
import { ThemeToggle } from '@repo/brand/react';

const NAV = [['#apps', 'Apps'], ['#blaze', 'Blaze'], ['#build', 'Build'], [LINKS.docs, 'Docs'], [LINKS.brand, 'Brand']] as const;

export function SiteHeader() {
  return (
    <header className="cx-header sticky top-0 z-30">
      <a className="cx-lockup" href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logos/charisma-mark.png" alt="" />Charisma
      </a>
      <nav className="cx-nav hidden md:flex">
        {NAV.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <a className="cx-btn cx-btn-primary" href={LINKS.swap}>Launch Swap</a>
      </div>
    </header>
  );
}
