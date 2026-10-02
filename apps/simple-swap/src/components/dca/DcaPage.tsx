"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TokenDropdown from '@/components/TokenDropdown';
import { Chip } from '@/components/advanced/Chip';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { useSubnetTokens } from '@/contexts/subnet-tokens-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { canSignInBulk } from 'blaze-sdk';
import { depositToSubnet, placeDcaBuys } from '@/lib/dca/orders';
import BlazeWalletPitch from './BlazeWalletPitch';
import { waitForConfirmation } from '@/lib/zesty/subnet';
import { fromUnits, toUnits } from '@/lib/units';
import { listTokens } from '@/app/actions';
import { CHA_SUBNET_V1, CHA_SUBNET_V2, chaPlan, isChaSubnet } from '@/lib/cha-subnets';
import { chaPlanNow } from '@/lib/cha-commitments';
import ChaUpgrade from '@/components/cha-upgrade/ChaUpgrade';

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
// Other wallets sign each buy separately; Blaze Wallet signs them all at once, so it has no cap
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
    const { getSubnetBalance, getSubnetBalanceExact, getTokenBalance } = useBalances(address ? [address] : []);
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
    // Which wallet is connected lives in the browser, so it's read after the first render
    const [bulk, setBulk] = useState(false);
    useEffect(() => setBulk(canSignInBulk()), [address]);

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
    let toMove = amountRaw > fromHeld.subnet ? amountRaw - fromHeld.subnet : 0n;
    // CHA sits in two subnets: the buys spend one of them (old first), and wallet CHA tops up v2
    const chaHeld = (subnet: string) => address ? getSubnetBalanceExact(address, subnet) : 0;
    let chaSplit: string | null = null;
    if (isChaSubnet(fromSubnet) && amountRaw > 0n && amountRaw <= balance) {
        try {
            toMove = chaPlan(amountRaw, BigInt(Math.floor(chaHeld(CHA_SUBNET_V1))), BigInt(Math.floor(chaHeld(CHA_SUBNET_V2))), fromHeld.wallet).deposit;
        } catch (err) {
            chaSplit = (err as Error).message;
        }
    }
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
            : chaSplit
                ? chaSplit
            : buys < 2
                ? 'Pick a longer time or buy more often, so there are at least 2 buys'
                : buys > MAX_BUYS && !bulk
                    ? `That's ${buys.toLocaleString('en-US')} buys. Your wallet signs each one, so keep it to ${MAX_BUYS}, or use Blaze Wallet to sign them all at once.`
                    : amountRaw > 0n && perBuy === 0n
                        ? 'Each buy would be too small. Spend more or buy less often.'
                        : null;
    const ready = !!(address && from && to && fromSubnet && decimals !== undefined && perBuy > 0n && !problem);
    const approvals = (bulk ? 1 : buys) + (toMove > 0n ? 1 : 0);

    const start = async () => {
        if (!ready || !from || !to || !fromSubnet) return;
        setError(null);
        setPhase('signing');
        try {
            // Settle which CHA subnet pays now, counting what open orders already spend
            const { source, deposit } = isChaSubnet(fromSubnet)
                ? await chaPlanNow(address!, amountRaw, chaHeld(CHA_SUBNET_V1), chaHeld(CHA_SUBNET_V2), fromHeld.wallet)
                : { source: fromSubnet, deposit: toMove };
            if (deposit > 0n) {
                setProgress('Approve moving funds in your wallet…');
                const txid = await depositToSubnet(address!, from, source, deposit);
                setProgress('Getting funds ready… about a minute');
                await waitForConfirmation(txid);
            }
            const strategyId = crypto.randomUUID();
            const startsAt = Date.now();
            await placeDcaBuys(Array.from({ length: buys }, (_, i) => ({
                wallet: address!,
                strategyId,
                strategySize: buys,
                position: i + 1,
                fromSubnet: source,
                to: to.contractId,
                amount: perBuy,
                validFrom: new Date(startsAt + i * every),
                validTo: new Date(startsAt + (i + 1) * every),
            })), setProgress);
            setAmountText('');
            setPhase('done');
        } catch (err) {
            setError((err as Error).message);
            setPhase('setup');
        }
    };

    const everyLabel = EVERY.find(e => e.ms === every)?.label.toLowerCase();

    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-ink">DCA</h1>
                <p className="text-sm text-ink-muted">Buy a little at a time, on a schedule. Set it once and walk away.</p>
            </div>

            <ChaUpgrade />

            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px] items-start">
            <div className="rounded-xl border border-line bg-surface p-4 space-y-5">
                {phase === 'done' ? (
                    <div className="space-y-4">
                        <div className="text-lg font-medium text-ink">Your DCA is running ✓</div>
                        <p className="text-sm text-ink-muted">
                            {buys.toLocaleString('en-US')} buys of {to?.symbol}, {everyLabel}. The first runs now. You can close this page.
                        </p>
                        <div className="flex gap-2">
                            <Link href="/orders" className="flex-1 rounded-lg border border-line-strong px-3 py-2 text-center text-sm text-ink hover:bg-surface-hover">View in Orders</Link>
                            <button type="button" onClick={() => setPhase('setup')} className="flex-1 rounded-lg border border-line px-3 py-2 text-sm text-ink-body hover:border-line-strong hover:text-ink">Start another</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <div className="text-xs text-ink-muted">Spend</div>
                            {!address
                                ? <div className="text-sm text-ink-muted">Connect a wallet to pick a token.</div>
                                : listError
                                    ? <p role="alert" className="text-sm text-danger">Couldn&apos;t load swappable tokens: {listError}</p>
                                    : swappable
                                        ? <TokenDropdown tokens={payable.filter(t => t.contractId !== to?.contractId)} selected={from} onSelect={t => { setFrom(t); setAmountText(''); }} label="Pick a token you hold" showBalances includeStx={false} />
                                        : <div className="text-sm text-ink-muted">Loading…</div>}
                            {from && decimals !== undefined && (
                                <>
                                    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-sunken px-3 py-2 focus-within:border-line-strong">
                                        <input
                                            inputMode="decimal"
                                            placeholder="0"
                                            value={amountText}
                                            onChange={e => setAmountText(e.target.value.replace(/[^\d.]/g, ''))}
                                            className="min-w-0 flex-1 bg-transparent font-mono text-lg text-ink outline-none placeholder:text-ink-faint"
                                        />
                                        <span className="text-sm text-ink-muted">{from.symbol}</span>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {SHARES.map(s => (
                                            <Chip key={s} active={amountRaw > 0n && amountRaw === shareRaw(s)} onClick={() => setAmountText(fromUnits(shareRaw(s), decimals))}>
                                                {s === 1 ? 'All' : `${s * 100}%`}
                                            </Chip>
                                        ))}
                                    </div>
                                    <div className="text-right text-xs text-ink-muted">
                                        You hold <span className="font-mono">{fmt(Number(balance) / 10 ** decimals)}</span> {from.symbol}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs text-ink-muted">Into</div>
                            {swappable && <TokenDropdown tokens={buyable} selected={to} onSelect={setTo} label="Pick a token to buy" includeStx={false} />}
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs text-ink-muted">How often</div>
                            <div className="flex gap-1.5">
                                {EVERY.map(e => <Chip key={e.label} active={every === e.ms} onClick={() => setEvery(e.ms)}>{e.label}</Chip>)}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs text-ink-muted">For how long</div>
                            <div className="flex gap-1.5">
                                {FOR.map(f => <Chip key={f.label} active={span === f.ms} onClick={() => setSpan(f.ms)}>{f.label}</Chip>)}
                            </div>
                        </div>

                        {from && to && decimals !== undefined && perBuy > 0n && !problem && (
                            <div className="rounded-lg bg-surface px-3 py-2 text-sm text-ink-body">
                                <span className="font-mono">{buys.toLocaleString('en-US')}</span> buys of <span className="font-mono">{fmt(Number(perBuy) / 10 ** decimals)}</span> {from.symbol} → {to.symbol}, {everyLabel}
                            </div>
                        )}

                        {(error || problem) && <p role="alert" className="text-sm text-danger">{error ?? problem}</p>}

                        <button
                            type="button"
                            onClick={start}
                            disabled={!ready || phase === 'signing'}
                            className="w-full rounded-lg bg-ink/90 px-4 py-3 text-sm font-medium text-bg hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {phase === 'signing' ? progress : `Start DCA (${approvals} ${approvals === 1 ? 'approval' : 'approvals'})`}
                        </button>
                        <p className="text-xs text-ink-muted">
                            The first buy runs now. If a buy can&apos;t run in its slot, it&apos;s skipped. Tokens go to your wallet.
                        </p>
                    </>
                )}
            </div>
            <BlazeWalletPitch connected={bulk} buys={buys} cap={MAX_BUYS} />
            </div>
        </div>
    );
}
