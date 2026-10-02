'use client';

import { useState } from 'react';
import { ChevronDown, Copy, LogOut, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/sonner';
import { DepositCharismaButton } from '@/components/DepositCharismaButton';
import { SwapStxToChaButton } from '@/components/SwapStxToChaButton';
import { useWallet } from '@/contexts/wallet-context';
import { formatUnits, shortAddress } from '@/lib/format';

/** The header's one wallet control: Connect, or your playable CHA. Everything else lives in its side panel. */
export function WalletMenu() {
    const { address, connected, connectWallet, disconnectWallet, isConnecting, mainnetBalance, subnetBalance, balanceLoading, subnetBalanceLoading } = useWallet();
    const [open, setOpen] = useState(false);

    if (!connected || !address) {
        return (
            <Button onClick={connectWallet} disabled={isConnecting} size="sm">
                {isConnecting ? 'Connecting…' : 'Connect wallet'}
            </Button>
        );
    }

    const playable = subnetBalanceLoading ? '…' : formatUnits(subnetBalance, 6, true);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="Your wallet"
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-on-chrome-muted/25 px-3 text-sm text-on-chrome transition-colors hover:bg-on-chrome/10"
            >
                <span className="font-mono font-semibold text-chrome-accent">{playable}</span>
                <span className="text-xs text-on-chrome-muted">CHA</span>
                <span className="hidden font-mono text-xs text-on-chrome-muted lg:inline">· {shortAddress(address)}</span>
                <ChevronDown className="h-3.5 w-3.5 text-on-chrome-muted" />
            </button>

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent className="flex flex-col gap-6">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Your wallet</SheetTitle>
                        <SheetDescription className="font-mono text-xs break-all">{address}</SheetDescription>
                    </SheetHeader>

                    <div className="rounded-xl border border-line bg-surface p-4">
                        <p className="text-xs uppercase tracking-[0.1em] text-ink-muted">Ready to play</p>
                        <p className="mt-1 font-mono text-2xl font-bold">{playable} <span className="text-sm text-ink-muted">CHA</span></p>
                        <p className="mt-2 text-xs text-ink-muted">
                            In your wallet, not in the game yet: <span className="font-mono">{balanceLoading ? '…' : formatUnits(mainnetBalance, 6, true)} CHA</span>
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <SwapStxToChaButton buttonLabel="Get CHA with STX" className="w-full" />
                        <DepositCharismaButton buttonLabel="Move wallet CHA into the game" variant="outline" className="w-full" />
                    </div>

                    <div className="mt-auto flex gap-2">
                        <Button variant="ghost" className="flex-1" onClick={() => { navigator.clipboard.writeText(address); toast.success('Address copied'); }}>
                            <Copy className="h-4 w-4" /> Copy address
                        </Button>
                        <Button variant="ghost" className="flex-1 hover:text-danger" onClick={() => { setOpen(false); disconnectWallet(); }}>
                            <LogOut className="h-4 w-4" /> Sign out
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
