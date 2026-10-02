import { describe, expect, it } from 'vitest';
import { drawWinner, fundedBets, newSeed, sha256Hex, slicesOf } from './draw';
import { layoutSlices, sliceAtPointer, SPIN_MS, ticketAngle, wheelRotation } from './wheel';
import { advanceRound, createRound, type EngineDeps } from './engine';
import { memoryStore } from './store';
import { noHooks } from './hooks';
import { placeBet, BetError, type BetDeps } from './bets';
import { toPublicRound } from './public';
import type { Chain } from './chain';
import type { Bet } from './types';
import { CHA_SUBNET_V1, CHA_SUBNET_V2 } from './subnets';
import { upgradeToV2, type UpgradeDeps } from './upgrade';
import { MULTIHOP_V2_CONTRACT_ID } from 'blaze-sdk';

const W = 'SP1.welsh', P = 'SP2.pepe', R = 'SP3.roo';
const bet = (uuid: string, user: string, tokenId: string, amount: number, placedAt = 0): Bet =>
    ({ uuid, user, tokenId, amount: String(amount), signature: `sig-${uuid}`, router: 'SP.x-multihop-v1', placedAt, status: 'placed' });

describe('draw', () => {
    it('commits to the seed', () => {
        const { seed, seedHash } = newSeed();
        expect(seed).toMatch(/^[0-9a-f]{64}$/);
        expect(sha256Hex(seed)).toBe(seedHash);
    });

    it('is deterministic for a seed, a block hash and slices', () => {
        const slices = slicesOf([bet('a', 'u1', W, 30), bet('b', 'u2', P, 70)]);
        const a = drawWinner('11'.repeat(32), '0xabc123', slices);
        expect(drawWinner('11'.repeat(32), '0xabc123', slices)).toEqual(a);
        expect(BigInt(a.ticket)).toBeLessThan(100n);
        expect(a.turns).toBeGreaterThanOrEqual(6);
        expect(a.turns).toBeLessThanOrEqual(9);
    });

    it('maps the ticket into the right stake range', () => {
        const slices = slicesOf([bet('a', 'u1', W, 30), bet('b', 'u2', P, 70)]); // sorted: SP1.welsh [0,30), SP2.pepe [30,100)
        for (let i = 0; i < 200; i++) {
            const r = drawWinner(i.toString(16).padStart(64, '0'), '0xfeed', slices);
            expect(r.winner).toBe(BigInt(r.ticket) < 30n ? W : P);
        }
    });

    it('roughly follows the stakes', () => {
        const slices = slicesOf([bet('a', 'u1', W, 25), bet('b', 'u2', P, 75)]);
        let welsh = 0;
        for (let i = 0; i < 2000; i++) if (drawWinner(i.toString(16).padStart(64, '0'), '0x01', slices).winner === W) welsh++;
        expect(welsh / 2000).toBeGreaterThan(0.2);
        expect(welsh / 2000).toBeLessThan(0.3);
    });

    it('a single bettor always wins; no stake means no winner', () => {
        expect(drawWinner('22'.repeat(32), '0x02', slicesOf([bet('a', 'u1', R, 5)])).winner).toBe(R);
        expect(drawWinner('22'.repeat(32), '0x02', []).winner).toBeNull();
    });

    it('funds each subnet on its own', () => {
        const bets = [{ ...bet('a', 'u1', W, 40, 1), subnet: CHA_SUBNET_V2 }, bet('b', 'u1', P, 40, 2)];
        const { valid, excluded } = fundedBets(bets, new Map([[`u1|${CHA_SUBNET_V2}`, 50n], [`u1|${CHA_SUBNET_V1}`, 10n]]));
        expect(valid.map(b => b.uuid)).toEqual(['a']);
        expect(excluded.map(b => b.uuid)).toEqual(['b']);
    });

    it('keeps each user\'s oldest bets while they fit the balance', () => {
        const bets = [bet('a', 'u1', W, 40, 1), bet('b', 'u1', P, 40, 2), bet('c', 'u1', R, 40, 3), bet('d', 'u2', W, 10, 1)];
        const { valid, excluded } = fundedBets(bets, new Map([[`u1|${CHA_SUBNET_V1}`, 90n], [`u2|${CHA_SUBNET_V1}`, 5n]]));
        expect(valid.map(b => b.uuid)).toEqual(['a', 'b']);
        expect(excluded.map(b => b.uuid).sort()).toEqual(['c', 'd']);
    });
});

describe('wheel', () => {
    const slices = slicesOf([bet('a', 'u1', W, 30), bet('b', 'u2', P, 70)]);

    it('starts at 0, only moves forward, and lands the ticket under the pointer', () => {
        const r = drawWinner('33'.repeat(32), '0x03', slices);
        let prev = -1;
        for (let t = 0; t <= SPIN_MS; t += 250) {
            const angle = wheelRotation(1000 + t, 1000, r.ticket, r.total, r.turns);
            expect(angle).toBeGreaterThanOrEqual(prev);
            prev = angle;
        }
        expect(wheelRotation(1000, 1000, r.ticket, r.total, r.turns)).toBe(0);
        const end = wheelRotation(1000 + SPIN_MS * 2, 1000, r.ticket, r.total, r.turns);
        expect(sliceAtPointer(layoutSlices(slices), end)?.tokenId).toBe(r.winner);
    });

    it('agrees with the draw for every ticket', () => {
        const layout = layoutSlices(slices);
        for (let i = 0; i < 300; i++) {
            const r = drawWinner(i.toString(16).padStart(64, '0'), '0x04', slices);
            const end = wheelRotation(SPIN_MS, 0, r.ticket, r.total, r.turns);
            expect(sliceAtPointer(layout, end)?.tokenId).toBe(r.winner);
        }
    });

    it('places the ticket proportionally', () => {
        expect(ticketAngle('50', '100')).toBeCloseTo(Math.PI);
        expect(ticketAngle('0', '0')).toBe(0);
    });
});

/** A chain that never touches the network: balances, a block a few seconds after any time, and scripted swaps. */
function fakeChain(balances: Record<string, bigint>, opts: { fail?: Set<string>; pending?: boolean } = {}) {
    const sent: string[] = [];
    const chain: Chain = {
        // tests fund v1 by user, and v2 under `${user}|v2`
        balance: async (u, subnet) => (subnet === CHA_SUBNET_V2 ? balances[`${u}|v2`] : balances[u]) ?? 0n,
        firstBlockAtOrAfter: async ms => ({ height: 100, hash: '0x' + 'ab'.repeat(32), time: Math.ceil(ms / 1000) + 5 }),
        swap: async b => {
            if (opts.fail?.has(b.uuid)) throw new Error('route failed');
            sent.push(b.uuid);
            return { txid: `0xtx-${b.uuid}` };
        },
        txOutcome: async () => (opts.pending ? { status: 'pending' } : { status: 'success', amountOut: '777' }),
        uuidSpent: async () => false,
        upgrade: async () => ({ txid: '0xupgrade' }),
    };
    return { chain, sent };
}

function setup(balances: Record<string, bigint> = {}, opts = {}) {
    let clock = 1_000_000;
    const store = memoryStore();
    const { chain, sent } = fakeChain(balances, opts);
    const deps: EngineDeps = { store, chain, hooks: noHooks, now: () => clock };
    return { store, deps, sent, tick: (ms: number) => { clock += ms; }, now: () => clock };
}

describe('engine', () => {
    it('creates the first round, keeping the legacy schedule when it is in the future', async () => {
        const { store, deps, now } = setup();
        await advanceRound({ ...deps, legacyEndsAt: async () => now() + 10 * 60_000 }, 1000);
        const round = (await store.getRound((await store.getCurrentId())!))!;
        expect(round.id).toBe('round_1');
        expect(round.endsAt).toBe(now() + 10 * 60_000);
        expect(round.locksAt).toBe(round.endsAt - 60_000);
    });

    it('draws once even when called concurrently, and opens the next round after the intermission', async () => {
        const { store, deps, tick, now } = setup({ u1: 100n, u2: 100n });
        const config = await store.getConfig();
        const round = await createRound(deps, 1, now(), config);
        await store.addBet(round.id, bet('a', 'u1', W, 30));
        await store.addBet(round.id, bet('b', 'u2', P, 70));
        tick(config.roundMs);
        const reports = await Promise.all([advanceRound(deps, 5000), advanceRound(deps, 5000), advanceRound(deps, 5000)]);
        expect(reports.filter(r => r.drawn).length).toBe(1);
        const drawn = (await store.getRound('round_1'))!;
        expect(drawn.draw!.winner).toMatch(/SP1.welsh|SP2.pepe/);
        const next = (await store.getRound('round_2'))!;
        expect(next.opensAt).toBe(drawn.draw!.drawnAt + config.intermissionMs);
        expect(await store.getCurrentId()).toBe('round_2');
        // calling again doesn't redraw
        await advanceRound(deps, 5000);
        expect((await store.getRound('round_1'))!.draw).toEqual(drawn.draw);
    });

    it('broadcasts each valid bet once, confirms it, and settles the round', async () => {
        const { store, deps, sent, tick, now } = setup({ u1: 100n, u2: 10n });
        const config = await store.getConfig();
        const round = await createRound(deps, 1, now(), config);
        await store.addBet(round.id, bet('a', 'u1', W, 60, 1));
        await store.addBet(round.id, bet('b', 'u2', P, 50, 2)); // u2 can't cover it
        tick(config.roundMs);
        await advanceRound(deps, 5000); // draw + broadcast
        await advanceRound(deps, 5000); // confirm + settle
        await advanceRound(deps, 5000);
        expect(sent).toEqual(['a']);
        const bets = Object.fromEntries((await store.getBets(round.id)).map(b => [b.uuid, b]));
        expect(bets.a.status).toBe('confirmed');
        expect(bets.a.amountOut).toBe('777');
        expect(bets.b.status).toBe('excluded');
        expect((await store.getRound(round.id))!.status).toBe('settled');
    });

    it('retries a swap that failed on-chain', async () => {
        const { store, deps, sent, tick, now } = setup({ u1: 100n });
        const config = await store.getConfig();
        const round = await createRound(deps, 1, now(), config);
        await store.addBet(round.id, bet('a', 'u1', W, 60));
        tick(config.roundMs);
        await advanceRound(deps, 5000); // broadcast
        await advanceRound({ ...deps, chain: { ...deps.chain, txOutcome: async () => ({ status: 'failed', reason: 'abort_by_post_condition' }) } }, 5000);
        expect((await store.getBet(round.id, 'a'))!.status).toBe('sent'); // went again in the same pass
        expect(sent).toEqual(['a', 'a']);
    });

    it('retries a failed swap, then gives up after three attempts', async () => {
        const { store, deps, tick, now } = setup({ u1: 100n }, { fail: new Set(['a']) });
        const config = await store.getConfig();
        const round = await createRound(deps, 1, now(), config);
        await store.addBet(round.id, bet('a', 'u1', W, 60));
        tick(config.roundMs);
        for (let i = 0; i < 5; i++) await advanceRound(deps, 5000);
        const a = (await store.getBet(round.id, 'a'))!;
        expect(a.status).toBe('failed');
        expect(a.attempts).toBe(3);
        expect((await store.getRound(round.id))!.status).toBe('settled');
    });

    it('resumes a bet left sending by a crash, without counting a landed swap as failed', async () => {
        const { store, deps, sent, tick, now } = setup({ u1: 100n });
        const config = await store.getConfig();
        const round = await createRound(deps, 1, now(), config);
        await store.addBet(round.id, bet('a', 'u1', W, 60));
        tick(config.roundMs);
        // draw without settling, then fake the crash state
        await advanceRound({ ...deps, chain: { ...deps.chain, swap: async () => { throw new Error('crash'); } } }, 5000);
        await store.putBet(round.id, { ...(await store.getBet(round.id, 'a'))!, status: 'sending' });
        await advanceRound({ ...deps, chain: { ...deps.chain, uuidSpent: async () => true } }, 5000);
        expect(sent).toEqual([]);
        expect((await store.getBet(round.id, 'a'))!.status).toBe('confirmed');
    });

    it('finishes the hand-off when a crash left a drawn round current', async () => {
        const { store, deps, tick, now } = setup({ u1: 100n });
        const config = await store.getConfig();
        const round = await createRound(deps, 1, now(), config);
        await store.addBet(round.id, bet('a', 'u1', W, 60));
        tick(config.roundMs);
        // the draw is saved, then the process dies before history and the next round
        await store.saveRound({ ...round, status: 'drawn', version: 2, draw: { block: { height: 1, hash: '0x01', time: 0 }, ticket: '0', total: '60', slices: [{ tokenId: W, stake: '60' }], winner: W, drawnAt: now(), turns: 6 } });
        await advanceRound(deps, 5000);
        expect(await store.getCurrentId()).toBe('round_2');
        expect(await store.history(5)).toContain('round_1');
        expect((await store.getBet(round.id, 'a'))!.status).toBe('sent');
    });

    it('a round nobody played settles at once with no winner', async () => {
        const { store, deps, tick, now } = setup();
        const config = await store.getConfig();
        await createRound(deps, 1, now(), config);
        tick(config.roundMs);
        await advanceRound(deps, 5000);
        const r = (await store.getRound('round_1'))!;
        expect(r.status).toBe('settled');
        expect(r.draw!.winner).toBeNull();
    });

    it('never publishes the seed before the draw', async () => {
        const { store, deps, now } = setup();
        const round = await createRound(deps, 1, now(), await store.getConfig());
        expect(toPublicRound(round, [])).not.toHaveProperty('seed');
    });
});

describe('bets', () => {
    async function betSetup(balance = 50_000_000n) {
        const s = setup();
        const round = await createRound(s.deps, 1, s.now(), await s.store.getConfig());
        const deps: BetDeps = {
            store: s.store,
            chain: { balance: async () => balance },
            hooks: { betPlaced: async () => [] },
            now: s.now,
            signedRouter: async i => { if (!i.signature.startsWith('good')) throw new Error('bad'); return 'SP.x-multihop-v1'; },
            isPlayable: async t => t === W,
        };
        return { ...s, round, bdeps: deps };
    }
    const input = (uuid: string, amount = '10000000', signature = 'good', subnet: string = CHA_SUBNET_V1) =>
        ({ uuid, user: 'u1', tokenId: W, amount, signature, subnet });
    const U1 = '00000000-0000-4000-8000-000000000001', U2 = '00000000-0000-4000-8000-000000000002';

    it('stores a signed, funded bet once per uuid', async () => {
        const { bdeps, store, round } = await betSetup();
        expect((await placeBet(bdeps, input(U1))).repeated).toBe(false);
        expect((await placeBet(bdeps, input(U1))).repeated).toBe(true);
        await expect(placeBet(bdeps, input(U1, '10000000', 'good-other'))).rejects.toMatchObject({ status: 409 });
        expect((await store.getBets(round.id)).length).toBe(1);
    });

    it('refuses bad signatures, unknown memes, tiny amounts and overspending', async () => {
        const { bdeps } = await betSetup(15_000_000n);
        await expect(placeBet(bdeps, input(U1, '10000000', 'bad'))).rejects.toMatchObject({ status: 401 });
        await expect(placeBet(bdeps, { ...input(U1), tokenId: P })).rejects.toMatchObject({ status: 400 });
        await expect(placeBet(bdeps, input(U1, '10'))).rejects.toMatchObject({ status: 400 });
        await placeBet(bdeps, input(U1));
        await expect(placeBet(bdeps, input(U2))).rejects.toMatchObject({ status: 402 });
    });

    it('checks a bet against the subnet it spends', async () => {
        const { bdeps } = await betSetup();
        const deps = { ...bdeps, chain: { balance: async (_u: string, subnet: string) => (subnet === CHA_SUBNET_V2 ? 50_000_000n : 0n) } };
        await expect(placeBet(deps, input(U1))).rejects.toMatchObject({ status: 402 });                       // v1 is empty
        expect((await placeBet(deps, input(U2, '10000000', 'good', CHA_SUBNET_V2))).bet.subnet).toBe(CHA_SUBNET_V2);
        await expect(placeBet(deps, input('00000000-0000-4000-8000-000000000003', '10000000', 'good', 'SP.other-subnet'))).rejects.toMatchObject({ status: 400 });
    });

    it('refuses bets once the round locks', async () => {
        const { bdeps, round, tick, now } = await betSetup();
        tick(round.locksAt - now());
        await expect(placeBet(bdeps, input(U1))).rejects.toBeInstanceOf(BetError);
    });
});

describe('upgrade', () => {
    const UP = '00000000-0000-4000-8000-0000000000aa';
    function upSetup(v1: bigint, router = MULTIHOP_V2_CONTRACT_ID) {
        const s = setup({ u1: v1 });
        const deps: UpgradeDeps = { store: s.store, chain: s.deps.chain, signedRouter: async () => router };
        return { ...s, deps };
    }
    it('moves free v1 CHA, keeping what live bets still need', async () => {
        const { store, deps, now } = upSetup(100_000_000n);
        const round = await createRound(setup().deps, 1, now(), await store.getConfig());
        await store.saveRound({ ...round }); // the same round in this store
        await store.setCurrentId(round.id);
        await store.addBet(round.id, bet('a', 'u1', W, 60_000_000));
        await expect(upgradeToV2(deps, { signature: 's', uuid: UP, user: 'u1', amount: '50000000' })).rejects.toMatchObject({ status: 402 });
        expect(await upgradeToV2(deps, { signature: 's', uuid: UP, user: 'u1', amount: '40000000' })).toEqual({ txid: '0xupgrade' });
        await expect(upgradeToV2(deps, { signature: 's', uuid: UP, user: 'u1', amount: '40000000' })).rejects.toMatchObject({ status: 409 });
    });
    it('only takes intents signed for x-multihop-v2', async () => {
        const { deps } = upSetup(100_000_000n, 'SP.x-multihop-v1');
        await expect(upgradeToV2(deps, { signature: 's', uuid: UP, user: 'u1', amount: '1000000' })).rejects.toMatchObject({ status: 400 });
    });
});
