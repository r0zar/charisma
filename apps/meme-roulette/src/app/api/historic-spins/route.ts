import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { listTokens } from 'dexterity-sdk';
import { kvStore } from '@/lib/roulette/store';

export interface HistoricSpinResult {
    roundId: string;
    startTime: number;
    endTime: number;
    winningTokenId: string | null;
    winningTokenInfo?: {
        name: string;
        symbol: string;
        image?: string;
    };
    totalCHA: number;
    totalParticipants: number;
    totalVotes: number;
    tokenBets: Record<string, number>;
    isATH: boolean;
    roundDuration: number;
}

const ROUND_META_KEY = (roundId: string) => `round:${roundId}:meta`;
const ROUND_TOTALS_KEY = (roundId: string) => `round:${roundId}:totals`;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Rounds from the first version of the game. The new engine copies its rounds here too (the leaderboard
        // reads them); those are listed, with replays, by /api/rounds, so they're left out.
        const newWheel = new Set(await kvStore.history(1000));
        const allIds: string[] = (await kv.zrange<string[]>('historic:rounds', 0, -1, { rev: true })).filter(id => !newWheel.has(id));
        const total = allIds.length;
        const pagedRoundIds = allIds.slice(offset, offset + limit);

        // Fetch all tokens for winner info enrichment
        const tokens = await listTokens();

        // Fetch round metadata and totals for each round
        const results: HistoricSpinResult[] = await Promise.all(
            pagedRoundIds.map(async (roundId) => {
                const meta = await kv.get<any>(ROUND_META_KEY(roundId));
                const totals = await kv.get<any>(ROUND_TOTALS_KEY(roundId));
                if (!meta) return null;

                // Find winning token info
                let winningTokenInfo = undefined;
                if (meta.winningTokenId && meta.winningTokenId !== 'none') {
                    const token = tokens.find((t: any) => t.contractId === meta.winningTokenId);
                    if (token) {
                        winningTokenInfo = {
                            name: token.name,
                            symbol: token.symbol,
                            image: token.image || undefined,
                        };
                    }
                }

                return {
                    roundId,
                    startTime: meta.startTime,
                    endTime: meta.endTime,
                    winningTokenId: meta.winningTokenId,
                    winningTokenInfo,
                    totalCHA: meta.totalCHACommitted || (totals?.totalCHACommitted ?? 0),
                    totalParticipants: meta.totalParticipants || (totals?.totalParticipants ?? 0),
                    totalVotes: meta.totalVotes || (totals?.totalVotes ?? 0),
                    tokenBets: totals?.tokenBets || {},
                    isATH: meta.isATH || false,
                    roundDuration: meta.endTime - meta.startTime,
                };
            })
        ).then(arr => arr.filter(Boolean) as HistoricSpinResult[]);

        return NextResponse.json({
            success: true,
            results,
            pagination: {
                limit,
                offset,
                total
            }
        });
    } catch (error) {
        console.error('Failed to fetch historic spins:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 