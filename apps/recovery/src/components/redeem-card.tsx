'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { request } from '@stacks/connect';
import { Cl, Pc } from '@stacks/transactions';
import { ArrowRight, Check, ExternalLink, Flame, Loader2, Wallet } from 'lucide-react';
import { ENGINE, TOKENS, type IouKey } from '@/lib/tokens';
import { amount, smaller } from '@/lib/format';
import { useWallet } from './wallet';

type Balances = Record<IouKey, bigint>;
type Phase = { kind: 'idle' } | { kind: 'signing' } | { kind: 'pending'; txid: string } | { kind: 'done'; txid: string; got: Balances } | { kind: 'error'; message: string };

const explorer = (txid: string) => `https://explorer.hiro.so/txid/0x${txid.replace(/^0x/, '')}?chain=mainnet`;

/** The redeemed amounts from a redeem-all result like (ok (tuple (roo u0) (stx u0) (welsh u1000))) */
function parseResult(repr: string): Balances {
  const pick = (k: IouKey) => BigInt(repr.match(new RegExp(`\\(${k} u(\\d+)\\)`))?.[1] ?? '0');
  return { welsh: pick('welsh'), roo: pick('roo'), stx: pick('stx') };
}

/** One click: burn your IOUs and get the original tokens back 1:1, as far as the engine's funds go */
export function RedeemCard({ engine }: { engine: Record<IouKey, string> }) {
  const { address, connect } = useWallet();
  const router = useRouter();
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const loadBalances = async (who: string) => {
    setLoadError(null);
    const res = await fetch(`/api/balances/${who}`);
    const json = await res.json();
    if (!res.ok) return setLoadError(json.error ?? `Couldn't load your IOUs (HTTP ${res.status})`);
    setBalances({ welsh: BigInt(json.welsh), roo: BigInt(json.roo), stx: BigInt(json.stx) });
  };

  useEffect(() => {
    setBalances(null);
    if (address) loadBalances(address).catch(e => setLoadError(String(e)));
  }, [address]);

  // Follow a redemption until the network confirms it
  useEffect(() => {
    if (phase.kind !== 'pending' || !address) return;
    const timer = setInterval(async () => {
      const res = await fetch(`https://api.hiro.so/extended/v1/tx/0x${phase.txid.replace(/^0x/, '')}`).catch(() => null);
      if (!res?.ok) return;
      const tx = await res.json();
      if (tx.tx_status === 'pending') return;
      clearInterval(timer);
      if (tx.tx_status !== 'success') return setPhase({ kind: 'error', message: `The redemption didn't go through (${tx.tx_status}). Nothing was taken from your wallet.` });
      setPhase({ kind: 'done', txid: phase.txid, got: parseResult(String(tx.tx_result?.repr ?? '')) });
      loadBalances(address);
      router.refresh();
    }, 8000);
    return () => clearInterval(timer);
  }, [phase, address]);

  const available: Balances = { welsh: BigInt(engine.welsh), roo: BigInt(engine.roo), stx: BigInt(engine.stx) };
  const rows = TOKENS.map(t => {
    const held = balances?.[t.key] ?? 0n;
    const now = smaller(held, available[t.key]);
    return { t, held, now, later: held - now };
  });
  const holdsAny = rows.some(r => r.held > 0n);
  const canRedeem = rows.some(r => r.now > 0n);

  const redeem = async () => {
    if (!address || !balances) return;
    setPhase({ kind: 'signing' });
    try {
      // Deny mode: you burn at most your IOUs, and the engine pays at most the same amount of each original
      const postConditions = rows.filter(r => r.held > 0n).flatMap(({ t, held }) => [
        Pc.principal(address).willSendLte(held).ft(t.iou.contractId as `${string}.${string}`, t.iou.asset),
        t.key === 'stx'
          ? Pc.principal(ENGINE).willSendLte(held).ustx()
          : Pc.principal(ENGINE).willSendLte(held).ft(t.original.contractId as `${string}.${string}`, t.original.asset!),
      ]);
      const { txid } = await request('stx_callContract', {
        contract: ENGINE as `${string}.${string}`,
        functionName: 'redeem-all',
        functionArgs: [Cl.uint(balances.welsh), Cl.uint(balances.roo), Cl.uint(balances.stx)],
        network: 'mainnet',
        postConditionMode: 'deny',
        postConditions,
      });
      if (!txid) throw new Error('The wallet did not return a transaction id');
      setPhase({ kind: 'pending', txid });
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
      <h2 className="text-lg font-semibold">Your IOUs</h2>

      {!address && (
        <div className="mt-4 grid gap-3">
          <p className="text-sm text-ink-body">Connect the wallet that holds your iouWELSH, iouROO or synSTX to see what you can get back.</p>
          <button type="button" onClick={connect} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-on-accent transition-colors hover:bg-accent-hover">
            <Wallet className="h-4 w-4" aria-hidden /> Connect wallet
          </button>
        </div>
      )}

      {address && !balances && !loadError && <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Looking up your IOUs…</p>}
      {loadError && <p className="mt-4 text-sm text-danger">{loadError}</p>}

      {address && balances && (
        <div className="mt-4 grid gap-4">
          {!holdsAny && <p className="text-sm text-ink-body">This wallet holds no recovery IOUs. If you were affected, try the wallet that held your tokens on 20 September 2024.</p>}

          {holdsAny && (
            <ul className="grid gap-2">
              {rows.filter(r => r.held > 0n).map(({ t, held, now, later }) => (
                <li key={t.key} className="grid gap-1 rounded-xl border border-line-soft bg-surface-sunken p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-semibold">
                      <img src={t.original.image} alt="" className="h-6 w-6 rounded-full" />
                      {amount(held)} {t.iou.symbol}
                    </span>
                    <ArrowRight className="h-4 w-4 text-ink-faint" aria-hidden />
                    <span className={`font-semibold tabular-nums ${now > 0n ? 'text-success' : 'text-ink-muted'}`}>{amount(now)} {t.original.symbol}</span>
                  </div>
                  {later > 0n && <p className="text-xs text-ink-muted">{amount(later)} {t.iou.symbol} keeps its 1:1 claim for the next refill.</p>}
                </li>
              ))}
            </ul>
          )}

          {holdsAny && phase.kind !== 'done' && (
            <button type="button" onClick={redeem} disabled={!canRedeem || phase.kind === 'signing' || phase.kind === 'pending'}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {phase.kind === 'signing' ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Confirm in your wallet…</>
                : phase.kind === 'pending' ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Redeeming…</>
                  : <><Flame className="h-4 w-4" aria-hidden /> Get my tokens back</>}
            </button>
          )}
          {holdsAny && !canRedeem && phase.kind === 'idle' && (
            <p className="text-sm text-ink-muted">The engine is empty right now. It's refilled as funds are recovered, and your IOUs keep their full 1:1 claim until then.</p>
          )}
          {phase.kind === 'pending' && (
            <p className="text-sm text-ink-muted">Waiting for the network, usually a minute or two. <a href={explorer(phase.txid)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-text hover:underline">View transaction <ExternalLink className="h-3 w-3" aria-hidden /></a></p>
          )}
          {phase.kind === 'done' && (
            <div className="grid gap-1 rounded-xl border border-success/40 bg-success-soft p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-success"><Check className="h-4 w-4" aria-hidden /> Done. Your IOUs are burned for good.</p>
              <p className="text-ink-body">You got back {TOKENS.filter(t => phase.got[t.key] > 0n).map(t => `${amount(phase.got[t.key])} ${t.original.symbol}`).join(', ') || 'nothing this time'}.</p>
              <a href={explorer(phase.txid)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-text hover:underline">View transaction <ExternalLink className="h-3 w-3" aria-hidden /></a>
            </div>
          )}
          {phase.kind === 'error' && <p className="text-sm text-danger">{phase.message}</p>}

          <p className="truncate font-mono text-xs text-ink-faint" title={address}>{address}</p>
        </div>
      )}
    </section>
  );
}
