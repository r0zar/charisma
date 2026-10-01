import { APP_GROUPS, LINKS } from '@/lib/site';

export function SiteFooter() {
  const buildGroup = APP_GROUPS.find(g => g.title === 'Build');
  if (!buildGroup) throw new Error('APP_GROUPS has no Build group');
  const build = buildGroup.apps;
  const apps = APP_GROUPS.filter(g => g.title !== 'Build').flatMap(g => g.apps);
  return (
    <footer className="cx-footer">
      <div>
        <a className="cx-lockup" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logos/charisma-mark.png" alt="" />Charisma
        </a>
        <p>Open-source apps on Stacks that belong to no one and work for everyone.</p>
      </div>
      <div><h4>Apps</h4>{apps.map(a => <a key={a.href} href={a.href}>{a.name}</a>)}</div>
      <div><h4>Build</h4>{build.map(a => <a key={a.href} href={a.href}>{a.name}</a>)}<a href={LINKS.brand}>Brand</a></div>
      <div><h4>Community</h4><a href={LINKS.discord}>Discord</a><a href={LINKS.x}>X</a><a href={LINKS.github}>GitHub</a><a href="/privacy-policy">Privacy policy</a></div>
    </footer>
  );
}
