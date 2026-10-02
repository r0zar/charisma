"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import TokenDropdown from '@/components/TokenDropdown';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { usePrices } from '@/contexts/token-price-context';
import { useSubnetTokens } from '@/contexts/subnet-tokens-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { boughtAmount, buyFromWallet, placeInAndOutOrder } from '@/lib/in-and-out/orders';
import { waitForConfirmation } from '@/lib/zesty/subnet';
import { listTokens } from '@/app/actions';
import { Chip } from '@/components/advanced/Chip';
import { fromUnits, toUnits } from '@/lib/units';

const ConditionTokenChart = dynamic(() => import('@/components/condition-token-chart'), { ssr: false });

const TARGETS = [0.1, 0.15, 0.25];

/** Where the profit is taken: steady tokens only */
const CASH_OUT_TOKENS = [
    'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token', // sBTC
    '.stx', // STX
    'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.usdh-token-v1', // USDh
    'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.susdh-token-v1', // sUSDh
];
const SAFETY = 0.1;
const FORM_KEY = 'in-and-out:form';
const SHARES = [0.05, 0.1, 0.25, 0.5, 1];

/** Up to 6 significant digits, no exponent */
const fmt = (n: number) => n.toLocaleString('en-US', { maximumSignificantDigits: 6 });

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-hover text-xs">{n}</span>
                {title}
            </div>
            {children}
        </div>
    );
}

/**
 * In & Out: buy a token now with something you hold on the subnet, and sell it into a steady token
 * (sBTC, STX, USDh or sUSDh) once it's up X%, with an optional safety net if it falls. The buy runs
 * right away; the two exits wait for their price, and when one runs the executor cancels the other.
 */
export default function InAndOutPage() {
    const { address } = useWallet();
    const { getPrice } = usePrices();
    const { getSubnetContractId } = useSubnetTokens();
    const { getSubnetBalance, getTokenBalance } = useBalances(address ? [address] : []);
    // Only tokens the router can trade, the same list the swap page offers
    const [swappable, setSwappable] = useState<TokenCacheData[] | null>(null);
    const [listError, setListError] = useState<string | null>(null);
    useEffect(() => {
        listTokens()
            .then(result => {
                if (!result.success || !result.tokens) throw new Error(result.error ?? 'Swappable tokens unavailable');
                // Same shape the swap page feeds its token pickers (dexterity-sdk's token list)
                setSwappable(result.tokens as unknown as TokenCacheData[]);
            })
            .catch(err => setListError((err as Error).message));
    }, []);

    const [pay, setPay] = useState<TokenCacheData | null>(null);
    const [buy, setBuy] = useState<TokenCacheData | null>(null);
    const [cashOut, setCashOut] = useState<TokenCacheData | null>(null);
    const [amountText, setAmountText] = useState('');
    const [targetPct, setTargetPct] = useState(0.15);
    const [safetyOn, setSafetyOn] = useState(true);
    const [phase, setPhase] = useState<'setup' | 'signing' | 'done'>('setup');
    const [progress, setProgress] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Keep the form across refreshes (this browser only). Restore runs before save, so it reads first.
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(FORM_KEY) ?? 'null');
            if (!saved) return;
            setPay(saved.pay);
            setBuy(saved.buy);
            setCashOut(saved.cashOut);
            setAmountText(saved.amountText);
            setTargetPct(saved.targetPct);
            setSafetyOn(saved.safetyOn);
        } catch {
            // Storage blocked or unreadable: start with a fresh form
        }
    }, []);
    useEffect(() => {
        try {
            localStorage.setItem(FORM_KEY, JSON.stringify({ pay, buy, cashOut, amountText, targetPct, safetyOn }));
        } catch {
            // Storage blocked: the form just won't survive a refresh
        }
    }, [pay, buy, cashOut, amountText, targetPct, safetyOn]);

    const paySubnet = pay ? getSubnetContractId(pay.contractId) : null;
    const buySubnet = buy ? getSubnetContractId(buy.contractId) : null;
    // What you hold, wherever it sits: the subnet part is spent first (just a signature), the rest from the wallet
    const held = (t: TokenCacheData) => {
        if (!address) return { subnet: 0n, wallet: 0n };
        const subnetId = getSubnetContractId(t.contractId);
        return {
            subnet: BigInt(Math.floor(subnetId ? getSubnetBalance(address, subnetId) : 0)),
            wallet: BigInt(Math.floor(getTokenBalance(address, t.contractId))),
        };
    };
    const payHeld = pay ? held(pay) : { subnet: 0n, wallet: 0n };
    const balance = payHeld.subnet + payHeld.wallet;
    // Never guess decimals: a token without them in the token list can't be traded here
    const decimals = pay?.decimals;
    const amountRaw = decimals !== undefined ? toUnits(amountText, decimals) : 0n;
    const tooMuch = amountRaw > balance;
    const fromSubnet = amountRaw < payHeld.subnet ? amountRaw : payHeld.subnet;
    const fromWallet = amountRaw - fromSubnet;
    const shareRaw = (s: number) => balance * BigInt(Math.round(s * 100)) / 100n;

    // The bought token, priced in the token the profit is taken in
    const priceBuy = buy ? getPrice(buy.contractId) : null;
    const priceOut = cashOut ? getPrice(cashOut.contractId) : null;
    const ratio = priceBuy && priceOut ? priceBuy / priceOut : null;
    const targetRatio = ratio ? ratio * (1 + targetPct) : null;
    const safetyRatio = ratio && safetyOn ? ratio * (1 - SAFETY) : null;

    // Anything the router trades that has a subnet version (the buy lands on the subnet)
    const payable = (swappable ?? []).filter(t => {
        if (t.type === 'SUBNET') return false;
        const h = held(t);
        return h.subnet + h.wallet > 0n;
    });
    const buyable = (swappable ?? []).filter(t =>
        t.type !== 'SUBNET' && t.contractId !== pay?.contractId && t.contractId !== cashOut?.contractId && !!getSubnetContractId(t.contractId));
    const cashOutTokens = CASH_OUT_TOKENS
        .map(id => (swappable ?? []).find(t => t.contractId === id))
        .filter((t): t is TokenCacheData => !!t);

    const problem = pay && decimals === undefined
        ? `${pay.symbol} has no decimals in the token list, so amounts can't be read safely`
        : pay && tooMuch
            ? `That's more ${pay.symbol} than you hold`
        : buy && cashOut && !ratio
            ? `No price for ${!priceBuy ? buy.symbol : cashOut.symbol} right now, so a target can't be set`
            : null;
    const ready = !!(address && pay && buy && cashOut && buySubnet && ratio && decimals !== undefined && amountRaw > 0n && !tooMuch);
    const signatures = (fromSubnet > 0n ? 1 : 0) + (fromWallet > 0n ? 1 : 0) + (safetyOn ? 2 : 1);

    const pickPay = (t: TokenCacheData) => {
        setPay(t);
        setAmountText('');
        if (buy?.contractId === t.contractId) setBuy(null);
        // Paying with a steady token? Take the profit back in the same one
        const steady = cashOutTokens.find(c => c.contractId === t.contractId);
        if (steady) setCashOut(steady);
    };

    const start = async () => {
        if (!ready || !pay || !buy || !cashOut || !buySubnet || !ratio || !targetRatio) return;
        setError(null);
        setPhase('signing');
        const common = { wallet: address!, strategyId: crypto.randomUUID(), strategySize: signatures, entryRatio: ratio };
        try {
            // The exits sell what the buy delivers at worst
            let bought = 0n;
            let txid: string | null = null;
            if (fromWallet > 0n) {
                setProgress('Approve the purchase in your wallet…');
                const purchase = await buyFromWallet(address!, pay.contractId, buySubnet, fromWallet);
                txid = purchase.txid;
                bought += purchase.bought;
            }
            if (fromSubnet > 0n) {
                setProgress('Sign the purchase…');
                bought += await boughtAmount(paySubnet!, buySubnet, fromSubnet);
                await placeInAndOutOrder({ ...common, role: 'buy', inputSubnet: paySubnet!, outputToken: buySubnet, amount: fromSubnet, movePct: 0 });
            }
            // The exits can only sell what has arrived
            if (txid) {
                setProgress('Buying… this takes about a minute');
                await waitForConfirmation(txid);
            }
            setProgress('Sign the sale…');
            const exit = { ...common, inputSubnet: buySubnet, outputToken: cashOut.contractId, amount: bought };
            await placeInAndOutOrder({ ...exit, role: 'target', movePct: targetPct, trigger: { token: buy.contractId, base: cashOut.contractId, ratio: targetRatio, direction: 'gt' } });
            if (safetyRatio) {
                await placeInAndOutOrder({ ...exit, role: 'safety', movePct: -SAFETY, trigger: { token: buy.contractId, base: cashOut.contractId, ratio: safetyRatio, direction: 'lt' } });
            }
            setAmountText('');
            setPhase('done');
        } catch (err) {
            setError((err as Error).message);
            setPhase('setup');
        }
    };

    return (
        <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
            <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-ink">In &amp; Out</h1>
                <p className="text-sm text-ink-muted">
                    Buy a token now, and sell it automatically once it&apos;s up. You pick the profit; it cashes out into sBTC, STX or a stablecoin.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                <div className="rounded-xl border border-line bg-surface p-4 flex flex-col">
                    {buy && cashOut && ratio ? (
                        <ConditionTokenChart
                            token={buy}
                            baseToken={cashOut}
                            targetPrice={targetRatio ? targetRatio.toString() : ''}
                            direction="gt"
                            onTargetPriceChange={price => {
                                // Dragging the line sets the target; it must stay above today's price
                                const next = Number(price) / ratio - 1;
                                if (Number.isFinite(next) && next > 0) setTargetPct(Math.round(next * 1000) / 1000);
                            }}
                            className="flex-1 min-h-[480px]"
                        />
                    ) : (
                        <div className="h-full min-h-[480px] flex items-center justify-center text-sm text-ink-muted">
                            {problem ?? 'Pick what to buy and where to cash out to see the chart.'}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-line bg-surface p-4 space-y-6">
                    {phase === 'done' ? (
                        <div className="space-y-4">
                            <div className="text-lg font-medium text-ink">You&apos;re in ✓</div>
                            <p className="text-sm text-ink-muted">
                                Buying {buy?.symbol} now. It sells into {cashOut?.symbol} at {targetRatio && fmt(targetRatio)} {cashOut?.symbol}
                                {safetyRatio ? `, or at ${fmt(safetyRatio)} if it drops first` : ''}. You can close this page.
                            </p>
                            <div className="flex gap-2">
                                <Link href="/orders" className="flex-1 rounded-lg border border-line-strong px-3 py-2 text-center text-sm text-ink hover:bg-surface-hover">View in Orders</Link>
                                <button type="button" onClick={() => setPhase('setup')} className="flex-1 rounded-lg border border-line px-3 py-2 text-sm text-ink-body hover:text-ink">Start another</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <Step n={1} title="In: buy now">
                                <div className="text-xs text-ink-muted">Pay with</div>
                                {!address
                                    ? <div className="text-sm text-ink-muted">Connect a wallet to pick a token.</div>
                                    : swappable && <TokenDropdown tokens={payable.filter(t => t.contractId !== buy?.contractId)} selected={pay} onSelect={pickPay} label="Pick a token you hold" showBalances includeStx={false} />}
                                {pay && decimals !== undefined && (
                                    <>
                                        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-sunken px-3 py-2 focus-within:border-line-strong">
                                            <input
                                                inputMode="decimal"
                                                placeholder="0"
                                                value={amountText}
                                                onChange={e => setAmountText(e.target.value.replace(/[^\d.]/g, ''))}
                                                className="min-w-0 flex-1 bg-transparent font-mono text-lg text-ink outline-none placeholder:text-ink-faint"
                                            />
                                            <span className="text-sm text-ink-muted">{pay.symbol}</span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            {SHARES.map(s => (
                                                <Chip key={s} active={amountRaw > 0n && amountRaw === shareRaw(s)} onClick={() => setAmountText(fromUnits(shareRaw(s), decimals))}>
                                                    {s === 1 ? 'All' : `${s * 100}%`}
                                                </Chip>
                                            ))}
                                        </div>
                                        <div className="text-right text-xs text-ink-muted">
                                            You hold <span className="font-mono">{fmt(Number(balance) / 10 ** decimals)}</span> {pay.symbol}
                                        </div>
                                    </>
                                )}
                                <div className="text-xs text-ink-muted pt-1">Buy</div>
                                {listError
                                    ? <p role="alert" className="text-sm text-danger">Couldn&apos;t load swappable tokens: {listError}</p>
                                    : swappable
                                        ? <TokenDropdown tokens={buyable} selected={buy} onSelect={setBuy} label="Pick a token to buy" includeStx={false} />
                                        : <div className="text-sm text-ink-muted">Loading…</div>}
                            </Step>

                            <Step n={2} title="Out: sell at a profit">
                                <div className="text-xs text-ink-muted">Cash out into</div>
                                {swappable && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {cashOutTokens.map(t => (
                                            <Chip key={t.contractId} active={cashOut?.contractId === t.contractId} onClick={() => { setCashOut(t); if (buy?.contractId === t.contractId) setBuy(null); }}>
                                                <span className="flex flex-col items-center gap-1">
                                                    {t.image && (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={t.image} alt="" width={20} height={20} className="rounded-full" />
                                                    )}
                                                    {t.symbol}
                                                </span>
                                            </Chip>
                                        ))}
                                    </div>
                                )}
                                <div className="flex justify-between text-xs text-ink-muted pt-1">
                                    <span>🎯 Sell when it&apos;s up {!TARGETS.includes(targetPct) && `(+${(targetPct * 100).toFixed(1)}%)`}</span>
                                    {targetRatio && cashOut && <span className="font-mono">{fmt(targetRatio)} {cashOut.symbol}</span>}
                                </div>
                                <div className="flex gap-2">
                                    {TARGETS.map(t => <Chip key={t} active={targetPct === t} onClick={() => setTargetPct(t)}>+{t * 100}%</Chip>)}
                                </div>
                                {ratio && buy && cashOut && (
                                    <div className="flex justify-between text-xs text-ink-muted">
                                        <span>Now</span>
                                        <span className="font-mono">1 {buy.symbol} = {fmt(ratio)} {cashOut.symbol}</span>
                                    </div>
                                )}
                                <label className="flex items-center justify-between gap-3 pt-1 text-sm text-ink-body cursor-pointer">
                                    <span>🛡️ Safety net: sell if it falls {SAFETY * 100}%{safetyRatio && cashOut ? ` (${fmt(safetyRatio)} ${cashOut.symbol})` : ''}</span>
                                    <input type="checkbox" checked={safetyOn} onChange={e => setSafetyOn(e.target.checked)} className="h-4 w-4 cursor-pointer accent-white" />
                                </label>
                            </Step>

                            {(error || problem) && <p role="alert" className="text-sm text-danger">{error ?? problem}</p>}

                            <button
                                type="button"
                                onClick={start}
                                disabled={!ready || phase === 'signing'}
                                className="w-full rounded-lg bg-ink/90 px-4 py-3 text-sm font-medium text-bg hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {phase === 'signing' ? progress : `Buy now & set the exit (${signatures} signatures)`}
                            </button>
                            <p className="text-xs text-ink-muted">
                                Drag the target line on the chart to fine-tune it. The buy runs right away; the sale waits for its price. Keep this page open until the sale is signed. Proceeds go to your wallet.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
