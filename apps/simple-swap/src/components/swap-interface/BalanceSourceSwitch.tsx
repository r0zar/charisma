'use client';

import { Flame } from 'lucide-react';
import type { BlazeVersion } from 'blaze-sdk';
import { formatCompactNumber } from '@/lib/swap-utils';

const compact = (formatted: string) => formatCompactNumber(Number(formatted.replace(/,/g, '')));

/** The Stacks mark: two bars, split by an X */
const StacksMark = ({ className = '' }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
        <path d="M6 3l5 6.5M18 3l-5 6.5M4 9.5h16M4 14.5h16M11 14.5L6 21M13 14.5l5 6.5" />
    </svg>
);

/**
 * Where a token comes from (or lands): Stacks, or Blaze (the token's subnet). Both are the user's own balance, moved
 * only by their signature, so the halves are named as equals. The same switch on both sides of a swap, and each half
 * shows its balance, so the choice explains itself.
 */
export default function BalanceSourceSwitch({ label, subnet, onChange, wallet, subnetBalance, blazeVersion, lockedReason }: {
    label: string;
    subnet: boolean;
    onChange: (subnet: boolean) => void;
    /** Formatted balances (Stacks, Blaze), as the balance context gives them; left out when no wallet is connected */
    wallet?: string;
    subnetBalance?: string;
    blazeVersion: BlazeVersion;
    /** Set when only Blaze works here; the Stacks half is then disabled with this as its reason */
    lockedReason?: string;
}) {
    const option = (isSubnet: boolean) => {
        const active = subnet === isSubnet;
        const disabled = !!lockedReason && !isSubnet;
        const flame = blazeVersion === 2 ? 'text-blaze-v2' : 'text-blaze';
        const balance = isSubnet ? subnetBalance : wallet;
        return (
            <button
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                title={disabled ? lockedReason : undefined}
                onClick={() => { if (!active) onChange(isSubnet); }}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors ${
                    active ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                } ${disabled ? 'cursor-not-allowed opacity-50 hover:text-ink-muted' : 'cursor-pointer'}`}
            >
                {isSubnet
                    ? <Flame className={`h-3 w-3 ${active ? `${flame} fill-current` : ''}`} />
                    : <StacksMark className="h-3 w-3" />}
                <span className="font-medium">{isSubnet ? 'Blaze' : 'Stacks'}</span>
                {balance !== undefined && <span className="font-mono text-ink-muted">{compact(balance)}</span>}
            </button>
        );
    };

    return (
        <div
            role="radiogroup"
            aria-label={label}
            className="inline-flex rounded-lg border border-line-soft bg-surface-sunken p-0.5"
            onClick={(e) => e.stopPropagation()}
        >
            {option(false)}
            {option(true)}
        </div>
    );
}
