import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import TokenLogo from '../TokenLogo';
import { Loader2, Check, X as XIcon } from 'lucide-react';
import { TokenCacheData } from '@repo/tokens';
import { useRouter } from 'next/navigation';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useRouterTrading } from '@/hooks/useRouterTrading';

export const DcaDialog: React.FC = () => {
    const EASY_PRESET = { slices: 4, intervalHours: 24 } as const;
    const router = useRouter();

    // Get all needed state from context
    const {
        displayAmount,
        selectedFromToken,
        selectedToToken,
        conditionToken,
        baseToken,
        targetPrice,
        conditionDir,
    } = useSwapTokens();

    const {
        createSingleOrder,
    } = useRouterTrading();

    // Use context values
    const open = false;
    const onOpenChange = (v: boolean) => { };
    const defaultAmount = displayAmount;
    const fromToken = selectedFromToken;
    const toToken = selectedToToken;
    const direction = conditionDir;
    const createOrder = createSingleOrder;

    const [intervalOption, setIntervalOption] = useState<'hourly' | 'daily' | 'weekly' | 'custom'>('daily');
    const [slices, setSlices] = useState<number>(12);
    const [intervalHours, setIntervalHours] = useState<number>(24); // custom input fallback
    const [phase, setPhase] = useState<'setup' | 'processing' | 'complete'>('setup');
    const [statuses, setStatuses] = useState<Array<'pending' | 'signing' | 'done' | 'error'>>(() => Array(slices).fill('pending'));

    const hours = intervalOption === 'hourly' ? 1 : intervalOption === 'daily' ? 24 : intervalOption === 'weekly' ? 24 * 7 : intervalHours;

    const perSliceAmount = parseFloat(defaultAmount || '0') / slices;

    const startProcessing = async () => {
        if (phase !== 'setup') return;
        setPhase('processing');
        const nowMs = Date.now();
        const intervalMs = hours * 60 * 60 * 1000;

        for (let i = 0; i < slices; i++) {
            setStatuses((prev) => prev.map((s, idx) => (idx === i ? 'signing' : s)));
            const validFrom = new Date(nowMs + i * intervalMs).toISOString();
            const validTo = new Date(nowMs + (i + 1) * intervalMs).toISOString();
            try {
                await createOrder({ amountDisplay: perSliceAmount.toString(), validFrom, validTo });
                setStatuses((prev) => prev.map((s, idx) => (idx === i ? 'done' : s)));
            } catch (err) {
                console.error('slice error', err);
                setStatuses((prev) => prev.map((s, idx) => (idx === i ? 'error' : s)));
                // abort remaining slices
                break;
            }
        }
        setPhase('complete');
    };

    // Helper: generate preview rows
    const preview = (() => {
        const out: { idx: number; window: string; amount: string }[] = [];
        const total = parseFloat(defaultAmount || '0');
        if (isNaN(total) || slices <= 0) return out;
        const per = total / slices;
        const nowMs = Date.now();
        const intervalMs = hours * 60 * 60 * 1000;
        for (let i = 0; i < slices; i++) {
            const start = new Date(nowMs + i * intervalMs);
            const end = new Date(nowMs + (i + 1) * intervalMs);
            const monthDay = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            out.push({
                idx: i + 1,
                window: `${monthDay} at ${startTime}`,
                amount: per.toLocaleString(undefined, { maximumFractionDigits: 6 }),
            });
        }
        return out;
    })();

    // Reset phase when dialog is opened or slices count changes
    useEffect(() => {
        if (open) {
            setPhase('setup');
            setStatuses(Array(slices).fill('pending'));
        }
    }, [open, slices]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Split this order over time (DCA)</DialogTitle>
                    <DialogDescription>
                        Instead of one large swap, create several smaller limit-orders on a schedule. This can smooth out price swings — a strategy called <strong>Dollar-Cost Averaging</strong>.
                    </DialogDescription>
                </DialogHeader>

                {/* Frequency selector */}
                <div className="grid grid-cols-4 gap-2 mt-4 text-sm font-medium">
                    {(['hourly', 'daily', 'weekly', 'custom'] as const).map(opt => (
                        <button
                            key={opt}
                            onClick={() => setIntervalOption(opt)}
                            className={`border rounded-md py-1 ${intervalOption === opt ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`}
                        >{opt === 'custom' ? 'Custom' : opt.charAt(0).toUpperCase() + opt.slice(1)}</button>
                    ))}
                </div>

                {/* Slices + custom interval */}
                <div className="py-4 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label htmlFor="slices" className="text-sm font-medium">Number of orders</label>
                        <input
                            id="slices"
                            type="number"
                            min={1}
                            className="w-full rounded border px-2 py-1 bg-background"
                            value={slices}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlices(Number(e.target.value))}
                        />
                    </div>
                    {intervalOption === 'custom' && (
                        <div className="space-y-1">
                            <label htmlFor="interval" className="text-sm font-medium">Interval (hours)</label>
                            <input
                                id="interval"
                                type="number"
                                min={1}
                                className="w-full rounded border px-2 py-1 bg-background"
                                value={intervalHours}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIntervalHours(Number(e.target.value))}
                            />
                        </div>
                    )}
                </div>

                {/* Order summary */}
                {fromToken && toToken && (
                    <div className="mt-4 flex items-center flex-wrap gap-2 text-sm">
                        <TokenLogo token={fromToken} size="sm" /> {defaultAmount} {fromToken.symbol}
                        <span className="text-muted-foreground">→</span>
                        <TokenLogo token={toToken} size="sm" /> {toToken.symbol}
                    </div>
                )}

                {conditionToken && (
                    <div className="text-xs text-muted-foreground mt-1">
                        Orders will execute if&nbsp;
                        <strong>{conditionToken.symbol}/{baseToken ? baseToken.symbol : 'USD'}</strong>
                        &nbsp;{direction === 'lt' ? '≤' : '≥'} {targetPrice} at any point during their window
                    </div>
                )}

                {/* Preview */}
                {preview.length > 0 && (
                    <div className="mt-0 text-xs border rounded-md p-3 bg-muted/20">
                        <table className="w-full">
                            <thead className="text-muted-foreground">
                                <tr>
                                    <th className="text-left w-4">#</th>
                                    <th className="text-left">Window</th>
                                    <th className="text-right">Amount</th>
                                    <th className="text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map(r => (
                                    <tr key={r.idx}>
                                        <td>{r.idx}</td>
                                        <td>{r.window}</td>
                                        <td className="text-right">{r.amount} {fromToken?.symbol}</td>
                                        <td className="text-center">
                                            {statuses[r.idx - 1] === 'signing' && <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />}
                                            {statuses[r.idx - 1] === 'done' && <Check className="h-4 w-4 text-green-500 mx-auto" />}
                                            {statuses[r.idx - 1] === 'error' && <XIcon className="h-4 w-4 text-red-500 mx-auto" />}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {preview.length > 0 && (
                    <div>
                        <p className="mt-2 text-xs text-muted-foreground italic">Orders are placed at the scheduled time and stay active for one interval before expiring.</p>
                    </div>
                )}

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    {phase === 'setup' && (
                        <Button onClick={startProcessing}>Start</Button>
                    )}
                    {phase === 'processing' && (
                        <Button disabled>Waiting…</Button>
                    )}
                    {phase === 'complete' && (
                        <Button
                            onClick={() => {
                                onOpenChange(false);
                                router.push('/orders');
                            }}
                        >
                            View my orders
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 