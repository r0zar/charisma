import { ArrowUpRight } from 'lucide-react';
import { APP_GROUPS } from '@/lib/site';

/** Every app as a quiet index: category, name, one short line. No cards, no repeated crest. */
export function AppIndex() {
  return (
    <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
      {APP_GROUPS.map(group => (
        <div key={group.title}>
          <p className="cx-label">{group.title}</p>
          <ul className="mt-4 border-t border-line">
            {group.apps.map(app => (
              <li key={app.href}>
                <a href={app.href} className="group flex items-center justify-between gap-3 border-b border-line-soft py-3.5 no-underline">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[17px] leading-[22px] font-bold text-ink transition-colors group-hover:text-accent-text">
                      {app.name}
                      {app.soon && <span className="cx-pill cx-pill-plain">Soon</span>}
                    </span>
                    <span className="mt-0.5 block text-[14px] leading-[20px] text-ink-muted">{app.line}</span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-ink-faint transition-colors group-hover:text-accent-text" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
