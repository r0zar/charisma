import { ArrowUpRight } from 'lucide-react';
import type { App } from '@/lib/site';

export function AppCard({ app, big = false }: { app: App; big?: boolean }) {
  return (
    <a href={app.href} className={`cx-card group flex flex-col gap-3 no-underline text-ink transition-colors hover:border-line-strong hover:bg-surface-hover ${big ? 'min-h-[220px]' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logos/charisma-mark.png" alt="" className="size-6" />
          <span className={`${big ? 'text-[22px] leading-[28px]' : 'text-[17px] leading-[22px]'} font-bold`}>
            {app.endorsed ? app.name : <>Charisma <span className="text-accent-text">{app.name}</span></>}
          </span>
        </span>
        <ArrowUpRight className="size-5 shrink-0 text-ink-muted transition-colors group-hover:text-accent-text" />
      </div>
      <p className={`flex-1 text-ink-body ${big ? 'text-[17px] leading-[26px]' : 'text-[15px] leading-[22px]'}`}>{app.blurb}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="mono text-[12px] text-ink-muted">{app.host}</span>
        {app.tag && <span className="cx-pill cx-pill-blaze">{app.tag}</span>}
        {app.endorsed && !app.tag && <span className="text-[12px] text-ink-muted">by Charisma</span>}
      </div>
    </a>
  );
}
