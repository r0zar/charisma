/* eslint-disable @next/next/no-img-element */
import type { RecoveryState, TokenState } from '@/lib/state';
import { TOKENS, whole } from '@/lib/tokens';
import { amount, pct, price, usd } from '@/lib/format';

const big = (s: string) => BigInt(s);

/** Dollars still needed to cover the IOUs in people's wallets 1:1, after what the engine already holds */
const costToFinish = (s: TokenState) => {
  const gap = big(s.walletsHeld) - big(s.engine);
  return gap > 0n ? whole(gap) * s.priceUsd : 0;
};

function Bar({ part, whole: total }: { part: bigint; whole: bigint }) {
  const width = total === 0n ? 0 : Math.max(Number((part * 10000n) / total) / 100, part > 0n ? 0.6 : 0);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-sunken" role="presentation">
      <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
    </div>
  );
}

/** Where the recovery stands: burned so far, who holds what's left, what the engine holds, and what finishing costs */
export function Progress({ state }: { state: RecoveryState }) {
  const total = state.tokens.reduce((sum, s) => sum + costToFinish(s), 0);
  const updated = new Date(state.updatedAt).toUTCString().slice(5, 22);

  return (
    <section className="grid gap-5" aria-labelledby="progress">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="progress" className="text-xl font-bold">Where the recovery stands</h2>
          <p className="text-sm text-ink-muted">Live from the chain · updated {updated} UTC</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.1em] text-ink-muted">To repay every wallet 1:1 today</p>
          <p className="text-3xl font-bold tabular-nums text-accent-text">{usd(total)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {state.tokens.map(s => {
          const t = TOKENS.find(x => x.key === s.key)!;
          const engine = big(s.engine), wallets = big(s.walletsHeld);
          const facts: [string, string, string?][] = [
            ['Still out there', `${amount(s.supply)} ${t.iou.symbol}`],
            ['In people\'s wallets', amount(s.walletsHeld), `${s.walletsCount} wallets · what redemptions are for`],
            ['In pools', amount(s.poolsHeld), 'Mostly liquidity Charisma added'],
            ['In Charisma\'s wallets', amount(s.charismaHeld), 'Can be burned at no cost'],
            ['In the engine now', `${amount(s.engine)} ${t.original.symbol}`, wallets > 0n ? `Covers ${pct(engine > wallets ? wallets : engine, wallets)} of wallets' IOUs` : undefined],
            ['To cover the rest', usd(costToFinish(s)), `At ${price(s.priceUsd)} per ${t.original.symbol}`],
          ];
          return (
            <article key={s.key} className="grid content-start gap-4 rounded-2xl border border-line bg-surface p-5">
              <header className="flex items-center gap-3">
                <img src={t.original.image} alt="" className="h-8 w-8 shrink-0 rounded-full" />
                <span className="min-w-0">
                  <span className="block font-semibold">{t.iou.symbol} <span className="text-ink-faint">→</span> {t.original.symbol}</span>
                  <span className="block text-xs text-ink-muted">For {t.lost}</span>
                </span>
              </header>
              <div className="grid gap-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{pct(big(s.burned), big(s.issued))} burned</span>
                  <span className="text-ink-muted tabular-nums">{amount(s.burned)} of {amount(s.issued)}</span>
                </div>
                <Bar part={big(s.burned)} whole={big(s.issued)} />
              </div>
              <dl className="grid gap-2 text-sm">
                {facts.map(([label, value, hint]) => (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <dt className="text-ink-muted">{label}{hint && <span className="block text-xs text-ink-faint">{hint}</span>}</dt>
                    <dd className="text-right font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
