/** The engine and bet service wired to production: KV, the Stacks chain, the leaderboard. */
import { kv } from '@vercel/kv';
import { findSignedRouter } from 'blaze-sdk';
import { listTokens } from 'dexterity-sdk';
import { kvStore } from './store';
import { stacksChain } from './chain';
import { leaderboardHooks } from './hooks';
import { isPlayableToken } from './playable';
import type { EngineDeps } from './engine';
import type { BetDeps } from './bets';
import type { UpgradeDeps } from './upgrade';

export const engineDeps: EngineDeps = {
    store: kvStore,
    chain: stacksChain,
    hooks: leaderboardHooks,
    now: () => Date.now(),
    // the v1 game's next spin, so the first v2 round keeps the announced schedule
    legacyEndsAt: () => kv.get<number>('spin:scheduled_at'),
    log: message => console.log(`[roulette] ${message}`),
};

let playable: { at: number; ids: Set<string> } | null = null;
async function isPlayable(tokenId: string): Promise<boolean> {
    if (!playable || Date.now() - playable.at > 60_000) {
        playable = { at: Date.now(), ids: new Set((await listTokens()).filter(isPlayableToken).map(t => t.contractId)) };
    }
    return playable.ids.has(tokenId);
}

export const betDeps: BetDeps = {
    store: kvStore,
    chain: stacksChain,
    hooks: leaderboardHooks,
    now: () => Date.now(),
    signedRouter: i => findSignedRouter(i.signature, i.uuid, i.subnet, i.amount, i.user),
    isPlayable,
};

export const upgradeDeps: UpgradeDeps = {
    store: kvStore,
    chain: stacksChain,
    signedRouter: i => findSignedRouter(i.signature, i.uuid, i.subnet, i.amount, i.user),
};
