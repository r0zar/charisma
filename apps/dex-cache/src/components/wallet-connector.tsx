"use client"

import * as React from 'react';
import { useApp } from '@/lib/context/app-context';
import { cn } from "@/lib/utils";

interface WalletConnectorProps extends React.HTMLAttributes<HTMLDivElement> { }

/** Header wallet button: the accent CTA to connect; once connected, a quiet outline on chrome with the address */
export function WalletConnector({ className, ...props }: WalletConnectorProps) {
    const { walletState, connectWallet, disconnectWallet } = useApp();

    const truncateAddress = (address: string) => `${address.substring(0, 5)}…${address.substring(address.length - 4)}`;

    return (
        <div className={cn("flex items-center", className)} {...props}>
            {walletState.connected ? (
                <button
                    onClick={disconnectWallet}
                    title="Disconnect"
                    className="h-9 min-w-[140px] px-4 rounded-xl border border-on-chrome-muted/40 text-on-chrome hover:border-on-chrome transition-all duration-200 flex items-center justify-center gap-2 font-mono text-[13px]"
                >
                    <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                    {truncateAddress(walletState.address)}
                </button>
            ) : (
                <button
                    onClick={connectWallet}
                    className="h-9 min-w-[140px] px-5 rounded-xl bg-accent text-on-accent text-sm font-semibold shadow-[var(--shadow-cta)] hover:bg-accent-hover active:scale-[0.98] transition-all duration-200"
                >
                    Connect wallet
                </button>
            )}
        </div>
    );
}
