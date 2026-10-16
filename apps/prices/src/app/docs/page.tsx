import type { Metadata } from 'next';
import { CopyPrompt } from '@/components/copy-prompt';
import { SiteHeader } from '@/components/site-header';
import { aiPrompt } from '@/lib/ai-prompt';

export const metadata: Metadata = {
  title: 'Prices API | Charisma Prices',
  description: 'A free, public API for live and historical prices of every token on Charisma.',
};

const BASE = 'https://prices.charisma.rocks/api/v1';
const STX = '.stx';

interface Param { name: string; about: string }
interface Endpoint { id: string; path: string; about: string; params: Param[]; example: string; response: string }

const ENDPOINTS: Endpoint[] = [
  {
    id: 'prices',
    path: '/prices',
    about: 'Every priced token: price in dollars and sBTC, change over 1 hour, 24 hours, 7 days and 30 days, and liquidity on Charisma. Sorted by liquidity.',
    params: [
      { name: 'tokens', about: 'Optional. Comma-separated contract ids to return only those tokens.' },
      { name: 'sparkline', about: 'Optional. 1 adds 7 days of closing prices (42 points) to each token, for small charts.' },
    ],
    example: `${BASE}/prices?tokens=${STX},SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`,
    response: `{
  "btcUsd": 81345.3,
  "updatedAt": "2026-10-16T18:40:34.494Z",
  "count": 2,
  "tokens": [
    {
      "contractId": ".stx",
      "symbol": "STX",
      "name": "Stacks Token",
      "image": "https://charisma.rocks/stx-logo.png",
      "decimals": 6,
      "usd": 0.395826,
      "sbtc": 0.000004866,
      "change": { "1h": -0.63, "24h": -2.12, "7d": 2.6, "30d": 69.6 },
      "liquidityUsd": 1578132,
      "roundTripLoss": 1.2,
      "thin": false,
      "updatedAt": "2026-10-16T18:40:34.494Z",
      "stale": false
    }
  ]
}`,
  },
  {
    id: 'token',
    path: '/prices/{contractId}',
    about: 'One token, with the same fields as above plus its 7-day sparkline. Answers 404 if we have never priced the token.',
    params: [],
    example: `${BASE}/prices/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token`,
    response: `{ "contractId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token", "symbol": "CHA", "usd": 0.1218, "change": { … }, "sparkline": [0.1201, 0.1195, …] }`,
  },
  {
    id: 'history',
    path: '/prices/{contractId}/history',
    about: 'Open, high, low and close for each period, oldest first. History starts on July 29, 2025. 5m candles are the raw 5-minute prices, so their open, high, low and close are equal.',
    params: [
      { name: 'interval', about: '5m, 1h (default), 4h, 1d or 1w.' },
      { name: 'quote', about: 'usd (default) or sbtc. Multiply sbtc by 100,000,000 for sats.' },
      { name: 'from, to', about: 'Optional. ISO dates or unix seconds. Defaults to the last day (5m), 7 days (1h), 30 days (4h) or all of it (1d, 1w). One request covers at most 7 days of 5m, 90 days of 1h or 365 days of 4h candles.' },
      { name: 'limit', about: 'Optional. Most candles to return, newest kept, from 1 to 2000. Default 500.' },
    ],
    example: `${BASE}/prices/${STX}/history?interval=1d&quote=usd&from=2026-01-01`,
    response: `{
  "token": ".stx",
  "interval": "1d",
  "quote": "usd",
  "count": 289,
  "candles": [
    { "time": 1767225600, "open": 0.6785, "high": 0.6835, "low": 0.6577, "close": 0.6626, "points": 288 }
  ]
}`,
  },
  {
    id: 'health',
    path: '/health',
    about: 'Whether prices are fresh. Answers 200 while the last recording is under 15 minutes old and 503 after that, so uptime monitors can watch it.',
    params: [],
    example: `${BASE}/health`,
    response: `{ "ok": true, "lastRecordedAt": "2026-10-16T18:40:34.494Z", "ageSeconds": 27, "tokensPriced": 92 }`,
  },
];

const NOTES: [string, string][] = [
  ['How prices are made', 'Every 5 minutes we buy about $1 of each token with sBTC through Charisma’s router and sell it straight back. The midpoint of those two prices cancels out fees. Dollar prices use Kraken’s BTC/USD. Blaze subnet tokens trade 1:1 with their base token, so they share its price.'],
  ['Junk filtering', 'A price more than 3x away from its token’s hourly median, or 10x away from its daily median, is left out of candles and changes. The raw history is kept untouched.'],
  ['Round-trip cost', 'roundTripLoss is the percent lost buying about $1 and selling it straight back, which shows how easy a token is to trade. 1–3% is healthy. Above 25% we set thin: true, because the price moves easily and is less reliable.'],
  ['Stale prices', 'stale: true means a token hasn’t been priced in the last 15 minutes, usually because its pools have no route right now. We keep showing its last known price.'],
  ['Freshness and limits', 'No key is needed, and any website can call it (CORS is open). Answers are cached and refresh as soon as new prices land, about every 5 minutes, so polling more than once a minute gains nothing. Past history never changes, so it’s cached for a day.'],
  ['For AI assistants', 'Everything on this page is also one plain-text prompt at /llms.txt.'],
];

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-lg border border-line bg-surface-sunken p-3 font-mono text-xs leading-relaxed text-ink-body">{children}</pre>;
}

export default function Docs() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-[1100px] grid-cols-1 gap-10 px-4 py-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-20 grid gap-1 text-sm">
            {ENDPOINTS.map(e => <li key={e.id}><a href={`#${e.id}`} className="block rounded px-2 py-1 font-mono text-xs text-ink-muted hover:bg-surface-hover hover:text-ink">{e.path}</a></li>)}
            <li><a href="#notes" className="block rounded px-2 py-1 text-xs text-ink-muted hover:bg-surface-hover hover:text-ink">How it works</a></li>
          </ul>
        </nav>
        <div className="grid min-w-0 gap-10">
          <header className="grid gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-balance">Prices API</h1>
            <p className="max-w-[65ch] text-ink-body">Live and historical prices for every token on Charisma, recorded every 5 minutes since July 2025. Free, public and no key needed.</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-accent-line bg-accent-soft p-4">
              <p className="min-w-0 flex-1 text-sm text-ink-body"><span className="font-semibold text-ink">Building with AI?</span> Copy one prompt that explains everything below, then tell your AI what you want to make.</p>
              <CopyPrompt text={aiPrompt()} />
            </div>
            <p className="text-sm text-ink-muted">Base URL</p>
            <Code>{BASE}</Code>
          </header>

          {ENDPOINTS.map(e => (
            <section key={e.id} id={e.id} className="grid scroll-mt-20 gap-3">
              <h2 className="flex flex-wrap items-baseline gap-2 text-lg font-semibold">
                <span className="rounded bg-success-soft px-1.5 py-0.5 font-mono text-xs text-success">GET</span>
                <span className="font-mono">{e.path}</span>
              </h2>
              <p className="max-w-[65ch] text-ink-body">{e.about}</p>
              {e.params.length > 0 && (
                <dl className="grid gap-2 rounded-lg border border-line bg-surface p-3 text-sm">
                  {e.params.map(p => (
                    <div key={p.name} className="grid gap-1 sm:grid-cols-[110px_minmax(0,1fr)]">
                      <dt className="font-mono text-xs text-accent-text">{p.name}</dt>
                      <dd className="text-ink-body">{p.about}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="text-xs uppercase tracking-[0.1em] text-ink-muted">Example</p>
              <Code>{`curl "${e.example}"`}</Code>
              <Code>{e.response}</Code>
            </section>
          ))}

          <section id="notes" className="grid scroll-mt-20 gap-4">
            <h2 className="text-lg font-semibold">How it works</h2>
            <dl className="grid gap-4">
              {NOTES.map(([title, body]) => (
                <div key={title}>
                  <dt className="font-semibold">{title}</dt>
                  <dd className="max-w-[65ch] text-ink-body">{body}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
    </>
  );
}
