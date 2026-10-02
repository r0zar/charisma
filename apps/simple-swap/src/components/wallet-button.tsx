"use client"

import React from "react";
import { useWallet } from "../contexts/wallet-context";

interface WalletButtonProps {
    className?: string;
}

/** Sits on the header's chrome bar: accent "Connect wallet", then the short address in mono */
export function WalletButton({ className }: WalletButtonProps) {
    const { connected, address, isConnecting, connectWallet, disconnectWallet } = useWallet();

    return (
        <div className={`flex items-center ${className || ''}`}>
            {!connected ? (
                <button
                    onClick={connectWallet}
                    disabled={isConnecting}
                    className="h-9 min-w-[140px] px-5 rounded-xl bg-accent text-on-accent text-sm font-semibold shadow-[var(--shadow-cta)] hover:bg-accent-hover disabled:opacity-60 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
                >
                    {isConnecting ? (
                        <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                            Connecting…
                        </>
                    ) : (
                        "Connect wallet"
                    )}
                </button>
            ) : (
                <button
                    onClick={disconnectWallet}
                    title="Disconnect"
                    className="h-9 min-w-[140px] px-4 rounded-xl border border-on-chrome-muted/40 text-on-chrome hover:border-on-chrome transition-all duration-200 flex items-center justify-center gap-2 font-mono text-[13px]"
                >
                    <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                    {address ? `${address.substring(0, 5)}…${address.substring(address.length - 4)}` : "Connected"}
                </button>
            )}
        </div>
    );
}
