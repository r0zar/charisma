'use client';

import { formatUnits, shortAddress } from '@/lib/format';
import { useTokens } from '@/contexts/tokens-context';
import { useWallet } from '@/contexts/wallet-context';
import { TokenLogo } from './TokenLogo';
import type { PublicBet } from '@/lib/roulette/types';

function ago(ms: number) {
    const s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
}

export function RecentBets({ bets, now }: { bets: PublicBet[]; now: number }) {
    const { byId } = useTokens();
    const { address } = useWallet();
    if (!bets.length) return <p className="text-sm text-ink-muted">No bets yet this round.</p>;
    return (
        <ul className="space-y-2">
            {bets.map(b => (
                <li key={b.uuid} className="flex items-center gap-3 text-sm">
                    <TokenLogo token={byId[b.tokenId]} size={20} />
                    <span className="min-w-0 flex-1 truncate">
                        <span className="font-mono text-ink-muted">{b.user === address ? 'You' : shortAddress(b.user)}</span>
                        {' backed '}
                        <span className="font-semibold">{byId[b.tokenId]?.symbol ?? b.tokenId.split('.')[1]}</span>
                    </span>
                    <span className="font-mono">{formatUnits(b.amount)} CHA</span>
                    <span className="w-16 text-right text-xs text-ink-faint">{ago(now - b.placedAt)}</span>
                </li>
            ))}
        </ul>
    );
}
