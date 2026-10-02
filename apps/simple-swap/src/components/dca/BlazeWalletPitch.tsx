"use client";

import { Zap } from 'lucide-react';

const BLAZE_WALLET_URL = 'https://wallet.charisma.rocks';

/** Beside the DCA form: Blaze Wallet signs every buy at once, so long plans take one tap */
export default function BlazeWalletPitch({ connected, buys, cap }: { connected: boolean; buys: number; cap: number }) {
    if (connected) {
        return (
            <div className="rounded-xl border border-accent/30 bg-accent/[0.06] p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-accent-text">
                    <Zap className="h-4 w-4" /> Blaze Wallet connected
                </div>
                <p className="text-sm text-ink-body">
                    All {buys > 1 ? buys.toLocaleString('en-US') : ''} buys, one approval. Go hourly for months if you like.
                </p>
            </div>
        );
    }
    return (
        <div className="rounded-xl border border-accent/30 bg-gradient-to-b from-accent/[0.10] to-transparent p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-accent-text">
                <Zap className="h-4 w-4" /> Sign once with Blaze Wallet
            </div>
            <p className="text-sm text-ink-body">
                Blaze Wallet signs every buy in one tap. Hourly for 3 months? That&apos;s 2,136 buys, one approval.
            </p>
            <p className="text-xs text-ink-muted">
                Other wallets ask for each buy, so plans stop at {cap}.
            </p>
            <a
                href={BLAZE_WALLET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg bg-accent/90 px-3 py-2 text-center text-sm font-medium text-on-accent hover:bg-accent"
            >
                Get Blaze Wallet →
            </a>
        </div>
    );
}
