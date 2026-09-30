"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TokenDropdown from '@/components/TokenDropdown';
import { Chip } from '@/components/advanced/Chip';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { useSubnetTokens } from '@/contexts/subnet-tokens-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { depositToSubnet, placeDcaBuy } from '@/lib/dca/orders';
import { waitForConfirmation } from '@/lib/zesty/subnet';
import { fromUnits, toUnits } from '@/lib/units';
import { listTokens } from '@/app/actions';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const EVERY = [
    { label: 'Hourly', ms: HOUR },
    { label: 'Daily', ms: DAY },
    { label: 'Weekly', ms: 7 * DAY },
];
// Orders expire after 90 days, so a plan never runs longer
const FOR = [
    { label: '1 day', ms: DAY },
    { label: '1 week', ms: 7 * DAY },
    { label: '1 month', ms: 30 * DAY },
    { label: '3 months', ms: 89 * DAY },
];
// Each buy is one signature
const MAX_BUYS = 30;
const SHARES = [0.05, 0.1, 0.25, 0.5, 1];
const FORM_KEY = 'dca:form';

/** Up to 6 significant digits, no exponent */
const fmt = (n: number) => n.toLocaleString('en-US', { maximumSignificantDigits: 6 });
const buysFor = (every: number, span: number) => Math.floor(span / every);

/**
 * DCA: spend an amount in equal buys, every hour/day/week, for a while. Each buy is its own signed
 * order with a time window; it runs when the window opens and expires if it can't run in time.
 */
export default function DcaPage() {
    const { address } = useWallet();
    const { getSubnetContractId } = useSubnetTokens();
    const { getSubnetBalance, getTokenBalance } = useBalances(address ? [address] : []);
    // Only tokens the router can trade, the same list the swap page offers
    const [swappable, setSwappable] = useState<TokenCacheData[] | null>(null);
    const [listError, setListError] = useState<string | null>(null);
    useEffect(() => {
        listTokens()
            .then(result => {
                if (!result.success || !result.tokens) throw new Error(result.error ?? 'Swappable tokens unavailable');
                setSwappable(result.tokens as unknown as TokenCacheData[]);
            })
            .catch(err => setListError((err as Error).message));
    }, []);

    const [from, setFrom] = useState<TokenCacheData | null>(null);
    const [to, setTo] = useState<TokenCacheData | null>(null);
    const [amountText, setAmountText] = useState('');
    const [every, setEvery] = useState(DAY);
    const [span, setSpan] = useState(7 * DAY);
    const [phase, setPhase] = useState<'setup' | 'signing' | 'done'>('setup');
    const [progress, setProgress] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Keep the form across refreshes (this browser only). Restore runs before save, so it reads first.
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(FORM_KEY) ?? 'null');
            if (!saved) return;
            setFrom(saved.from);
            setTo(saved.to);
            setAmountText(saved.amountText);
            setEvery(saved.every);
            setSpan(saved.span);
        } catch {
            // Storage blocked or unreadable: start with a fresh form
        }
    }, []);
    useEffect(() => {
        try {
            localStorage.setItem(FORM_KEY, JSON.stringify({ from, to, amountText, every, span }));
        } catch {
            // Storage blocked: the form just won't survive a refresh
        }
    }, [from, to, amountText, every, span]);

    // What you hold, wherever it sits: the buys spend from the subnet, so wallet funds move there first
    const held = (t: TokenCacheData) => {
        const subnetId = getSubnetContractId(t.contractId);
        if (!address || !subnetId) return { subnet: 0n, wallet: 0n };
        return {
            subnet: BigInt(Math.floor(getSubnetBalance(address, subnetId))),
            wallet: BigInt(Math.floor(getTokenBalance(address, t.contractId))),
        };
    };
    const fromSubnet = from ? getSubnetContractId(from.contractId) : null;
    const fromHeld = from ? held(from) : { subnet: 0n, wallet: 0n };
    const balance = fromHeld.subnet + fromHeld.wallet;
    // Never guess decimals: a token without them in the token list can't be traded here
    const decimals = from?.decimals;
    const amountRaw = decimals !== undefined ? toUnits(amountText, decimals) : 0n;
    const toMove = amountRaw > fromHeld.subnet ? amountRaw - fromHeld.subnet : 0n;
    const shareRaw = (s: number) => balance * BigInt(Math.round(s * 100)) / 100n;

    const buys = buysFor(every, span);
    const perBuy = buys > 0 ? amountRaw / BigInt(buys) : 0n;

    // Pay with anything that has a subnet version; buy anything the router trades
    const payable = (swappable ?? []).filter(t => {
        if (t.type === 'SUBNET') return false;
        const h = held(t);
        return h.subnet + h.wallet > 0n;
    });
    const buyable = (swappable ?? []).filter(t => t.type !== 'SUBNET' && t.contractId !== from?.contractId);

    const problem = from && decimals === undefined
        ? `${from.symbol} has no decimals in the token list, so amounts can't be read safely`
        : amountRaw > balance
            ? `That's more ${from?.symbol} than you hold`
            : buys < 2
                ? 'Pick a longer time or buy more often, so there are at least 2 buys'
                : buys > MAX_BUYS
                    ? `That's ${buys} buys; keep it to ${MAX_BUYS} or fewer (each is a signature)`
                    : amountRaw > 0n && perBuy === 0n
                        ? 'Each buy would be too small. Spend more or buy less often.'
                        : null;
    const ready = !!(address && from && to && fromSubnet && decimals !== undefined && perBuy > 0n && !problem);
    const signatures = buys + (toMove > 0n ? 1 : 0);

    const start = async () => {
        if (!ready || !from || !to || !fromSubnet) return;
        setError(null);
        setPhase('signing');
        try {
            if (toMove > 0n) {
                setProgress('Approve moving funds in your wallet…');
                const txid = await depositToSubnet(address!, from, fromSubnet, toMove);
                setProgress('Getting funds ready… about a minute');
                await waitForConfirmation(txid);
            }
            const strategyId = crypto.randomUUID();
            const startsAt = Date.now();
            for (let i = 0; i < buys; i++) {
                setProgress(`Sign buy ${i + 1} of ${buys}…`);
                await placeDcaBuy({
                    wallet: address!,
                    strategyId,
                    strategySize: buys,
                    position: i + 1,
                    fromSubnet,
                    to: to.contractId,
                    amount: perBuy,
                    validFrom: new Date(startsAt + i * every),
                    validTo: new Date(startsAt + (i + 1) * every),
                });
            }
            setAmountText('');
            setPhase('done');
        } catch (err) {
            setError((err as Error).message);
            setPhase('setup');
        }
    };

    const everyLabel = EVERY.find(e => e.ms === every)?.label.toLowerCase();

    return (
        <div className="w-full max-w-xl mx-auto px-4 py-6 space-y-6">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-white/95">DCA</h1>
                <p className="text-sm text-white/60">Buy a little at a time, on a schedule. Set it once and walk away.</p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-5">
                {phase === 'done' ? (
                    <div className="space-y-4">
                        <div className="text-lg font-medium text-white/95">Your DCA is running ✓</div>
                        <p className="text-sm text-white/60">
                            {buys} buys of {to?.symbol}, {everyLabel}. The first runs now. You can close this page.
                        </p>
                        <div className="flex gap-2">
                            <Link href="/orders" className="flex-1 rounded-lg border border-white/20 px-3 py-2 text-center text-sm text-white hover:bg-white/[0.06]">View in Orders</Link>
                            <button type="button" onClick={() => setPhase('setup')} className="flex-1 rounded-lg border border-white/[0.08] px-3 py-2 text-sm text-white/70 hover:border-white/20 hover:text-white">Start another</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <div className="text-xs text-white/60">Spend</div>
                            {!address
                                ? <div className="text-sm text-white/60">Connect a wallet to pick a token.</div>
                                : listError
                                    ? <p role="alert" className="text-sm text-red-400">Couldn&apos;t load swappable tokens: {listError}</p>
                                    : swappable
                                        ? <TokenDropdown tokens={payable.filter(t => t.contractId !== to?.contractId)} selected={from} onSelect={t => { setFrom(t); setAmountText(''); }} label="Pick a token you hold" showBalances includeStx={false} />
                                        : <div className="text-sm text-white/50">Loading…</div>}
                            {from && decimals !== undefined && (
                                <>
                                    <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 focus-within:border-white/30">
                                        <input
                                            inputMode="decimal"
                                            placeholder="0"
                                            value={amountText}
                                            onChange={e => setAmountText(e.target.value.replace(/[^\d.]/g, ''))}
                                            className="min-w-0 flex-1 bg-transparent font-mono text-lg text-white outline-none placeholder:text-white/30"
                                        />
                                        <span className="text-sm text-white/60">{from.symbol}</span>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {SHARES.map(s => (
                                            <Chip key={s} active={amountRaw > 0n && amountRaw === shareRaw(s)} onClick={() => setAmountText(fromUnits(shareRaw(s), decimals))}>
                                                {s === 1 ? 'All' : `${s * 100}%`}
                                            </Chip>
                                        ))}
                                    </div>
                                    <div className="text-right text-xs text-white/50">
                                        You hold <span className="font-mono">{fmt(Number(balance) / 10 ** decimals)}</span> {from.symbol}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs text-white/60">Into</div>
                            {swappable && <TokenDropdown tokens={buyable} selected={to} onSelect={setTo} label="Pick a token to buy" includeStx={false} />}
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs text-white/60">How often</div>
                            <div className="flex gap-1.5">
                                {EVERY.map(e => <Chip key={e.label} active={every === e.ms} onClick={() => setEvery(e.ms)}>{e.label}</Chip>)}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs text-white/60">For how long</div>
                            <div className="flex gap-1.5">
                                {FOR.map(f => <Chip key={f.label} active={span === f.ms} onClick={() => setSpan(f.ms)}>{f.label}</Chip>)}
                            </div>
                        </div>

                        {from && to && decimals !== undefined && perBuy > 0n && !problem && (
                            <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-white/80">
                                <span className="font-mono">{buys}</span> buys of <span className="font-mono">{fmt(Number(perBuy) / 10 ** decimals)}</span> {from.symbol} → {to.symbol}, {everyLabel}
                            </div>
                        )}

                        {(error || problem) && <p role="alert" className="text-sm text-red-400">{error ?? problem}</p>}

                        <button
                            type="button"
                            onClick={start}
                            disabled={!ready || phase === 'signing'}
                            className="w-full rounded-lg bg-white/90 px-4 py-3 text-sm font-medium text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {phase === 'signing' ? progress : `Start DCA (${signatures} signatures)`}
                        </button>
                        <p className="text-xs text-white/50">
                            The first buy runs now. If a buy can&apos;t run in its slot, it&apos;s skipped. Tokens go to your wallet.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
