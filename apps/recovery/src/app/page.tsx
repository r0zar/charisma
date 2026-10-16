import { Progress } from '@/components/progress';
import { RedeemCard } from '@/components/redeem-card';
import { SiteHeader } from '@/components/site-header';
import { getRecoveryState } from '@/lib/state';
import { ENGINE } from '@/lib/tokens';

export const revalidate = 60;

const STEPS = [
  ['20 September 2024', 'A governance attack on Charisma drained the WELSH and ROO staked in it, and the STX in its Velar CHA pools.'],
  ['The IOUs', 'Everyone affected received iouWELSH, iouROO or synSTX: a 1:1 claim on exactly what they lost.'],
  ['Getting it back', 'As funds are recovered they go into the recovery engine. Burn your IOUs here and the engine pays the real tokens back, 1:1, until every IOU is gone.'],
];

export default async function Home() {
  const state = await getRecoveryState();
  const engine = Object.fromEntries(state.tokens.map(s => [s.key, s.engine])) as Record<'welsh' | 'roo' | 'stx', string>;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-[1100px] grid-cols-1 gap-12 px-4 py-10">
        <section className="grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid gap-4">
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">Get your tokens back.</h1>
            <p className="max-w-[55ch] text-lg text-ink-body">Burn your iouWELSH, iouROO or synSTX and receive the original WELSH, ROO or STX, one for one, as far as the recovery engine&apos;s funds go. One click, and the IOUs you redeem are gone for good.</p>
            <ol className="mt-2 grid gap-3">
              {STEPS.map(([title, body], i) => (
                <li key={title} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-text">{i + 1}</span>
                  <p className="text-sm text-ink-body"><span className="font-semibold text-ink">{title}.</span> {body}</p>
                </li>
              ))}
            </ol>
          </div>
          <RedeemCard engine={engine} />
        </section>

        <Progress state={state} />

        <footer className="grid gap-1 border-t border-line pt-6 text-xs text-ink-muted">
          <p>The recovery engine is a public contract: <a href={`https://explorer.hiro.so/txid/${ENGINE}?chain=mainnet`} target="_blank" rel="noreferrer" className="break-all font-mono text-accent-text hover:underline">{ENGINE}</a>. Funds can only leave it when someone burns IOUs for them.</p>
          <p>Prices from <a href="https://prices.charisma.rocks" className="text-accent-text hover:underline">Charisma Prices</a>.</p>
        </footer>
      </main>
    </>
  );
}
