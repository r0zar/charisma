import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import TokenLogo from '../TokenLogo';
import { Loader2, Check, X as XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { useOrderConditions } from '@/contexts/order-conditions-context';
import { useRouterTrading } from '@/hooks/useRouterTrading';

export const DcaDialog: React.FC = () => {
    const EASY_PRESET = { slices: 4, intervalHours: 24 } as const;
    const router = useRouter();

    // Get token state from swap context
    const {
        displayAmount,
        selectedFromToken,
        selectedToToken,
        isDcaDialogOpen,
        setIsDcaDialogOpen,
    } = useSwapTokens();

    // Get condition state from order conditions context
    const {
        conditionToken,
        baseToken,
        targetPrice,
        conditionDir,
        hasTimeTrigger,
        timeStartTime,
        timeEndTime,
    } = useOrderConditions() as any;

    const {
        createSingleOrder,
    } = useRouterTrading();

    // Use context values
    const open = isDcaDialogOpen;
    const onOpenChange = setIsDcaDialogOpen;
    const defaultAmount = displayAmount;
    const fromToken = selectedFromToken;
    const toToken = selectedToToken;
    const direction = conditionDir;
    const createOrder = createSingleOrder;

    const [intervalOption, setIntervalOption] = useState<'hourly' | 'daily' | 'weekly' | 'custom'>('daily');
    const [slices, setSlices] = useState<number>(12);
    const [intervalHours, setIntervalHours] = useState<number>(24); // custom input fallback
    const [splitMode, setSplitMode] = useState<'by-count' | 'by-interval'>('by-count'); // For fixed time window
    const [phase, setPhase] = useState<'setup' | 'processing' | 'complete'>('setup');
    const [statuses, setStatuses] = useState<Array<'pending' | 'signing' | 'done' | 'error'>>(() => Array(slices).fill('pending'));

    // Check if we have a fixed time window (has time trigger enabled and end time set)
    const hasFixedTimeWindow = hasTimeTrigger && timeEndTime;
    const startTime = timeStartTime ? new Date(timeStartTime).getTime() : Date.now();
    const endTime = timeEndTime ? new Date(timeEndTime).getTime() : null;
    const totalWindowMs = endTime ? endTime - startTime : null;
    
    // For display purposes, use actual start time or current time
    const displayStartTime = timeStartTime ? new Date(timeStartTime) : new Date();

    // Calculate interval and slices based on mode
    let hours: number;
    let finalSlices: number;

    if (hasFixedTimeWindow && totalWindowMs && totalWindowMs > 0) {
        if (splitMode === 'by-count') {
            // User specifies number of slices, we calculate interval
            finalSlices = Math.max(1, slices);
            hours = totalWindowMs / (1000 * 60 * 60 * finalSlices);
        } else {
            // User specifies interval, we calculate number of slices
            hours = Math.max(0.1, intervalHours);
            finalSlices = Math.max(1, Math.floor(totalWindowMs / (hours * 60 * 60 * 1000)));
        }
    } else {
        // No fixed window - use original logic
        hours = intervalOption === 'hourly' ? 1 : intervalOption === 'daily' ? 24 : intervalOption === 'weekly' ? 24 * 7 : Math.max(0.1, intervalHours);
        finalSlices = Math.max(1, slices);
    }

    const perSliceAmount = parseFloat(defaultAmount || '0') / finalSlices;

    const startProcessing = async () => {
        if (phase !== 'setup') return;
        setPhase('processing');
        const intervalMs = hours * 60 * 60 * 1000;
        
        // Generate a shared strategy ID for all orders in this DCA batch
        const strategyId = globalThis.crypto?.randomUUID() ?? Date.now().toString();

        for (let i = 0; i < finalSlices; i++) {
            setStatuses((prev) => prev.map((s, idx) => (idx === i ? 'signing' : s)));
            const validFrom = new Date(startTime + i * intervalMs).toISOString();
            const validTo = new Date(startTime + (i + 1) * intervalMs).toISOString();
            try {
                await createOrder({ 
                    amountDisplay: perSliceAmount.toString(), 
                    validFrom, 
                    validTo,
                    strategyId,
                    strategyPosition: i,
                    strategySize: finalSlices
                });
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
        if (isNaN(total) || finalSlices <= 0) return out;
        const per = total / finalSlices;
        const intervalMs = hours * 60 * 60 * 1000;
        for (let i = 0; i < finalSlices; i++) {
            const start = new Date(startTime + i * intervalMs);
            const end = new Date(startTime + (i + 1) * intervalMs);
            const monthDay = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const startTimeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            const endTimeStr = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            out.push({
                idx: i + 1,
                window: `${monthDay} at ${startTimeStr}`,
                amount: per.toLocaleString(undefined, { maximumFractionDigits: 6 }),
            });
        }
        return out;
    })();

    // Reset phase when dialog is opened or slices count changes
    useEffect(() => {
        if (open) {
            setPhase('setup');
            // Ensure finalSlices is a valid positive integer
            const validSlices = Math.max(1, Math.min(100, Math.floor(finalSlices) || 1));
            setStatuses(Array(validSlices).fill('pending'));
        }
    }, [open, finalSlices]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-background border border-border backdrop-blur-xl">
                <DialogHeader className="space-y-3">
                    <DialogTitle className="text-xl font-semibold text-white/95">Split Swap</DialogTitle>
                    <DialogDescription className="text-white/70 leading-relaxed">
                        Instead of one large swap, create several smaller limit-orders on a schedule. This can smooth out price swings — a strategy called <span className="text-white/90 font-medium">Dollar-Cost Averaging</span>.
                    </DialogDescription>
                </DialogHeader>

                {/* Time Window Info */}
                {hasFixedTimeWindow && (
                    <div className="bg-blue-500/[0.08] border border-blue-500/[0.15] rounded-xl p-4 space-y-2">
                        <h4 className="text-sm font-medium text-blue-400">Fixed Time Window</h4>
                        <div className="text-xs text-white/70">
                            <div>Start: {displayStartTime.toLocaleString()}</div>
                            <div>End: {new Date(timeEndTime!).toLocaleString()}</div>
                            <div>Duration: {totalWindowMs ? Math.round(totalWindowMs / (1000 * 60 * 60)) : 0} hours</div>
                        </div>
                    </div>
                )}

                {/* Split Mode Selector (only for fixed time windows) */}
                {hasFixedTimeWindow ? (
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-white/90">Split Method</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setSplitMode('by-count')}
                                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                    splitMode === 'by-count' 
                                        ? 'bg-white/[0.1] text-white/95 border border-white/[0.15]' 
                                        : 'bg-white/[0.03] text-white/70 border border-white/[0.08] hover:bg-white/[0.05] hover:text-white/90 hover:border-white/[0.12]'
                                }`}
                            >
                                By Count
                            </button>
                            <button
                                onClick={() => setSplitMode('by-interval')}
                                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                    splitMode === 'by-interval' 
                                        ? 'bg-white/[0.1] text-white/95 border border-white/[0.15]' 
                                        : 'bg-white/[0.03] text-white/70 border border-white/[0.08] hover:bg-white/[0.05] hover:text-white/90 hover:border-white/[0.12]'
                                }`}
                            >
                                By Interval
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Frequency selector for open-ended time windows */
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-white/90">Interval Frequency</label>
                        <div className="grid grid-cols-4 gap-2">
                            {(['hourly', 'daily', 'weekly', 'custom'] as const).map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setIntervalOption(opt)}
                                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                        intervalOption === opt 
                                            ? 'bg-white/[0.1] text-white/95 border border-white/[0.15]' 
                                            : 'bg-white/[0.03] text-white/70 border border-white/[0.08] hover:bg-white/[0.05] hover:text-white/90 hover:border-white/[0.12]'
                                    }`}
                                >
                                    {opt === 'custom' ? 'Custom' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Controls */}
                <div className="space-y-4">
                        {/* Show slice count input for: no fixed window, or fixed window with by-count mode */}
                        {(!hasFixedTimeWindow || splitMode === 'by-count') && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="slices" className="text-sm font-medium text-white/90">
                                        Number of orders
                                    </label>
                                    {hasFixedTimeWindow && splitMode === 'by-count' && (
                                        <span className="text-xs text-white/60">Interval: {hours.toFixed(1)}h each</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="slices"
                                        type="number"
                                        min={1}
                                        className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/95 focus:outline-none focus:bg-white/[0.05] focus:border-white/[0.15] transition-all duration-200"
                                        value={slices}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlices(Number(e.target.value))}
                                    />
                                    <span className="text-sm text-white/60">orders</span>
                                </div>
                            </div>
                        )}

                        {/* Show interval input for: custom mode (no fixed window), or fixed window with by-interval mode */}
                        {(!hasFixedTimeWindow && intervalOption === 'custom') || (hasFixedTimeWindow && splitMode === 'by-interval') ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="interval" className="text-sm font-medium text-white/90">
                                        Interval
                                    </label>
                                    {hasFixedTimeWindow && splitMode === 'by-interval' && (
                                        <span className="text-xs text-white/60">Orders: {finalSlices}</span>
                                    )}
                                </div>
                                {hasFixedTimeWindow && splitMode === 'by-interval' ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-2">
                                            {[1, 24, 24 * 7].map(hrs => (
                                                <button
                                                    key={hrs}
                                                    onClick={() => setIntervalHours(hrs)}
                                                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                                        intervalHours === hrs 
                                                            ? 'bg-white/[0.1] text-white/95 border border-white/[0.15]' 
                                                            : 'bg-white/[0.03] text-white/70 border border-white/[0.08] hover:bg-white/[0.05] hover:text-white/90 hover:border-white/[0.12]'
                                                    }`}
                                                >
                                                    {hrs === 1 ? 'Hourly' : hrs === 24 ? 'Daily' : 'Weekly'}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                id="interval"
                                                type="number"
                                                min={0.1}
                                                step={0.1}
                                                placeholder="Custom"
                                                className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/95 focus:outline-none focus:bg-white/[0.05] focus:border-white/[0.15] transition-all duration-200"
                                                value={intervalHours}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIntervalHours(Number(e.target.value))}
                                            />
                                            <span className="text-sm text-white/60">hours</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            id="interval"
                                            type="number"
                                            min={0.1}
                                            step={0.1}
                                            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 text-white/95 focus:outline-none focus:bg-white/[0.05] focus:border-white/[0.15] transition-all duration-200"
                                            value={intervalHours}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIntervalHours(Number(e.target.value))}
                                        />
                                        <span className="text-sm text-white/60">hours</span>
                                    </div>
                                )}
                            </div>
                        ) : null}
                </div>

                {/* Order summary */}
                {fromToken && toToken && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
                        <h4 className="text-sm font-medium text-white/90">Order Summary</h4>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <TokenLogo token={fromToken} size="sm" />
                                <span className="text-sm font-medium text-white/95">{defaultAmount} {fromToken.symbol}</span>
                            </div>
                            <div className="text-white/60">→</div>
                            <div className="flex items-center gap-2">
                                <TokenLogo token={toToken} size="sm" />
                                <span className="text-sm font-medium text-white/95">{toToken.symbol}</span>
                            </div>
                        </div>
                        {conditionToken && (
                            <div className="text-xs text-white/60 bg-blue-500/[0.08] border border-blue-500/[0.15] rounded-lg px-2 py-1">
                                Orders execute when <span className="text-blue-400 font-medium">{conditionToken.symbol}/{baseToken ? baseToken.symbol : 'USD'}</span> {direction === 'lt' ? '≤' : '≥'} {targetPrice}
                            </div>
                        )}
                    </div>
                )}

                {/* Summary of calculated values */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-2">
                    <h4 className="text-sm font-medium text-white/90">Split Summary</h4>
                    <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                            <span className="text-white/60">Orders:</span>
                            <div className="text-white/90 font-medium">{finalSlices}</div>
                        </div>
                        <div>
                            <span className="text-white/60">Interval:</span>
                            <div className="text-white/90 font-medium">{hours < 1 ? `${Math.round(hours * 60)}m` : `${hours.toFixed(1)}h`}</div>
                        </div>
                        <div>
                            <span className="text-white/60">Per Order:</span>
                            <div className="text-white/90 font-medium">{perSliceAmount.toFixed(6)} {fromToken?.symbol}</div>
                        </div>
                    </div>
                </div>

                {/* Preview */}
                {preview.length > 0 && (
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3">
                        <h4 className="text-sm font-medium text-white/90">Execution Schedule</h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {preview.map(r => (
                                <div key={r.idx} className="bg-white/[0.02] rounded-lg p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-xs font-medium text-white/70">
                                            {r.idx}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-white/95">{r.window}</div>
                                            <div className="text-xs text-white/60">{r.amount} {fromToken?.symbol}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        {statuses[r.idx - 1] === 'pending' && (
                                            <div className="w-4 h-4 rounded-full bg-white/[0.1] border border-white/[0.2]"></div>
                                        )}
                                        {statuses[r.idx - 1] === 'signing' && (
                                            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                                        )}
                                        {statuses[r.idx - 1] === 'done' && (
                                            <Check className="h-4 w-4 text-green-400" />
                                        )}
                                        {statuses[r.idx - 1] === 'error' && (
                                            <XIcon className="h-4 w-4 text-red-400" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="text-xs text-white/60 italic bg-white/[0.02] rounded-lg px-3 py-2">
                            Orders are placed at the scheduled time and stay active for one interval before expiring.
                        </div>
                    </div>
                )}

                <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="px-4 py-2 bg-white/[0.05] text-white/70 hover:bg-white/[0.08] hover:text-white/90 border border-white/[0.08] hover:border-white/[0.12] rounded-xl text-sm font-medium transition-all duration-200"
                    >
                        Cancel
                    </button>
                    {phase === 'setup' && (
                        <button
                            onClick={startProcessing}
                            className="px-4 py-2 bg-white/[0.1] text-white/95 hover:bg-white/[0.15] hover:text-white/100 border border-white/[0.15] rounded-xl text-sm font-medium transition-all duration-200"
                        >
                            Start Split Swap
                        </button>
                    )}
                    {phase === 'processing' && (
                        <button
                            disabled
                            className="px-4 py-2 bg-white/[0.02] text-white/40 border border-white/[0.06] rounded-xl text-sm font-medium cursor-not-allowed opacity-50 flex items-center gap-2"
                        >
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing Orders…
                        </button>
                    )}
                    {phase === 'complete' && (
                        <button
                            onClick={() => {
                                onOpenChange(false);
                                router.push('/orders');
                            }}
                            className="px-4 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2"
                        >
                            <Check className="h-4 w-4" />
                            View My Orders
                        </button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}; 