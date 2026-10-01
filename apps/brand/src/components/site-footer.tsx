import Link from 'next/link';
import { NAV } from '@/lib/site';

const APPS = [
  ['Charisma', 'https://charisma.rocks'], ['Swap', 'https://swap.charisma.rocks'], ['Invest', 'https://invest.charisma.rocks'],
  ['Launchpad', 'https://launchpad.charisma.rocks'], ['Zesty', 'https://zesty.charisma.rocks'], ['Docs', 'https://docs.charisma.rocks'],
] as const;

export function SiteFooter() {
  return (
    <footer className="cx-footer mt-24">
      <div>
        <Link className="cx-lockup" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logos/charisma-mark.png" alt="" />Charisma <b>Brand</b>
        </Link>
        <p>The crest, the colours, the type and the components every Charisma app is built from.</p>
      </div>
      <div><h4>Brand</h4>{NAV.slice(0, 4).map(n => <Link key={n.href} href={n.href}>{n.label}</Link>)}</div>
      <div><h4>Build</h4>{NAV.slice(4).map(n => <Link key={n.href} href={n.href}>{n.label}</Link>)}<a href="/brand/tokens.json">tokens.json</a></div>
      <div><h4>Apps</h4>{APPS.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</div>
    </footer>
  );
}
