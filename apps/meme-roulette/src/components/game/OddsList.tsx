'use client';

import { layoutSlices } from '@/lib/roulette/wheel';
import { formatUnits } from '@/lib/format';
import { useTokens } from '@/contexts/tokens-context';
import { useRealmColors } from '@/components/wheel/colors';
import { TokenLogo } from './TokenLogo';
import type { Slice } from '@/lib/roulette/types';

/** The wheel's legend: every backed meme, its stake and its odds, coloured like its slice. */
export function OddsList({ slices, mine = [], winner, limit = 8 }: { slices: Slice[]; mine?: string[]; winner?: string | null; limit?: number }) {
    const { byId } = useTokens();
    const colors = useRealmColors();
    const layout = layoutSlices(slices);
    const colorOf = new Map(layout.map((s, i) => [s.tokenId, colors?.slices[i % colors.slices.length]]));
    const ranked = [...layout].sort((a, b) => b.stake - a.stake);

    if (!ranked.length) {
        return <p className="text-sm text-ink-muted">No meme has been backed yet. The first bet sets the odds.</p>;
    }
    return (
        <ul className="space-y-1.5">
            {ranked.slice(0, limit).map(s => {
                const token = byId[s.tokenId];
                return (
                    <li key={s.tokenId} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${s.tokenId === winner ? 'bg-success-soft' : ''}`}>
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorOf.get(s.tokenId) }} />
                        <TokenLogo token={token} size={22} />
                        <span className="min-w-0 flex-1 truncate font-semibold">
                            {token?.symbol ?? s.tokenId.split('.')[1]}
                            {mine.includes(s.tokenId) && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-text">yours</span>}
                        </span>
                        <span className="font-mono text-sm text-ink-muted">{formatUnits(s.stake, 6, true)} CHA</span>
                        <span className="w-12 text-right font-mono text-sm font-semibold">{Math.round(s.share * 1000) / 10}%</span>
                    </li>
                );
            })}
            {ranked.length > limit && <li className="px-2 text-xs text-ink-muted">and {ranked.length - limit} more</li>}
        </ul>
    );
}
