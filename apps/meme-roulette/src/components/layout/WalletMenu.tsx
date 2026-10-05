'use client';

import { useState } from 'react';
import { ChevronDown, Copy, LogOut, Sparkles, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/sonner';
import { DepositCharismaButton } from '@/components/DepositCharismaButton';
import { SwapStxToChaButton } from '@/components/SwapStxToChaButton';
import { useWallet } from '@/contexts/wallet-context';
import { formatUnits, shortAddress } from '@/lib/format';
import { useRound } from '@/hooks/useRound';
import { CHA_SUBNET_V1, subnetOf } from '@/lib/roulette/subnets';
import { AnimatedAmount } from '@repo/brand/react';

/** The header's one wallet control: Connect, or your playable CHA. Everything else lives in its side panel. */
export function WalletMenu() {
    const { address, connected, connectWallet, disconnectWallet, isConnecting, mainnetBalance, subnetBalance, subnetBalances, balanceLoading, subnetBalanceLoading, upgradeToV2 } = useWallet();
    const { payload } = useRound();
    const [open, setOpen] = useState(false);
    const [upgrading, setUpgrading] = useState(false);
    const [upgradeTx, setUpgradeTx] = useState<string | null>(null);

    if (!connected || !address) {
        return (
            <Button onClick={connectWallet} disabled={isConnecting} size="sm">
                {isConnecting ? 'Connecting…' : 'Connect wallet'}
            </Button>
        );
    }

    const playable = subnetBalanceLoading ? '…' : <AnimatedAmount value={Number(subnetBalance)} format={n => formatUnits(n, 6, true)} />;
    // Blaze v1 CHA can move to v2, except what bets still have to spend: the instant balance already sets that aside,
    // and the bets are named here only so the upgrade explains itself
    const v1 = BigInt(subnetBalances.v1 || '0');
    const upgradable = v1 > 0n ? v1 : 0n;
    const pendingV1 = [...(payload?.myBets ?? [])].filter(b => subnetOf(b) === CHA_SUBNET_V1 && ['placed', 'sending', 'sent'].includes(b.status))
        .reduce((sum, b) => sum + BigInt(b.amount), 0n);

    async function upgrade() {
        setUpgrading(true);
        try {
            const txid = await upgradeToV2(upgradable);
            setUpgradeTx(txid);
            toast.success('Upgrade on its way', { description: `${formatUnits(upgradable)} CHA is moving to Blaze v2.` });
        } catch (e) {
            toast.error('Upgrade failed', { description: e instanceof Error ? e.message : String(e) });
        } finally {
            setUpgrading(false);
        }
    }
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
                        {BigInt(subnetBalances.v1 || '0') > 0n && (
                            <p className="mt-1 text-xs text-ink-muted">
                                <span className="font-mono">{formatUnits(subnetBalances.v2, 6, true)}</span> on Blaze v2 · <span className="font-mono">{formatUnits(subnetBalances.v1, 6, true)}</span> on Blaze v1
                            </p>
                        )}
                        <p className="mt-2 text-xs text-ink-muted">
                            In your wallet, not in the game yet: <span className="font-mono">{balanceLoading ? '…' : formatUnits(mainnetBalance, 6, true)} CHA</span>
                        </p>
                    </div>

                    {upgradable >= 1_000_000n && (
                        <div className="rounded-xl border border-accent-line bg-accent-soft p-4">
                            <p className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-accent-text" /> Upgrade to Blaze v2</p>
                            <p className="mt-1 text-sm text-ink-muted">
                                Move {formatUnits(upgradable)} CHA to the new version. Free: one signature, and the game pays the fee.
                                {pendingV1 > 0n && ` ${formatUnits(pendingV1)} CHA stays on v1 for your bets.`}
                            </p>
                            <Button className="mt-3 w-full" onClick={upgrade} disabled={upgrading}>
                                {upgrading ? 'Waiting for your signature…' : `Upgrade ${formatUnits(upgradable)} CHA`}
                            </Button>
                            {upgradeTx && (
                                <a className="mt-2 block text-center text-xs text-accent-text underline" href={`https://explorer.hiro.so/txid/${upgradeTx}?chain=mainnet`} target="_blank" rel="noreferrer">
                                    View the upgrade
                                </a>
                            )}
                        </div>
                    )}

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
