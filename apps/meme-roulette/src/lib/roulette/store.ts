/** Where rounds and bets live. The engine and the bet route only talk to this interface. */
import { kv } from '@vercel/kv';
import { randomBytes } from 'node:crypto';
import type { Bet, Round, RouletteConfig, RouletteStats } from './types';

export interface Store {
    getConfig(): Promise<RouletteConfig>;
    setConfig(config: RouletteConfig): Promise<void>;
    getStats(): Promise<RouletteStats>;
    setStats(stats: RouletteStats): Promise<void>;
    getCurrentId(): Promise<string | null>;
    setCurrentId(id: string): Promise<void>;
    getRound(id: string): Promise<Round | null>;
    /** Writes `round` only if the stored version still equals `round.version - 1` (0 = must not exist). */
    saveRound(round: Round): Promise<boolean>;
    getBets(roundId: string): Promise<Bet[]>;
    getBet(roundId: string, uuid: string): Promise<Bet | null>;
    /** false when the uuid already exists */
    addBet(roundId: string, bet: Bet): Promise<boolean>;
    putBet(roundId: string, bet: Bet): Promise<void>;
    /** drawn rounds by endsAt, newest first */
    history(limit: number): Promise<string[]>;
    addHistory(id: string, endsAt: number): Promise<void>;
    /** a token to release with, or null when someone else holds it */
    lock(ttlMs: number): Promise<string | null>;
    unlock(token: string): Promise<void>;
    /** true the first time a key is claimed, false ever after (for one-shot actions like an upgrade) */
    once(key: string): Promise<boolean>;
}

export const DEFAULT_CONFIG: RouletteConfig = {
    roundMs: 5 * 60 * 1000,
    lockMs: 60 * 1000,
    intermissionMs: 60 * 1000,
};

const K = {
    config: 'roulette:v2:config',
    stats: 'roulette:v2:stats',
    current: 'roulette:v2:current',
    round: (id: string) => `roulette:v2:round:${id}`,
    bets: (id: string) => `roulette:v2:round:${id}:bets`,
    history: 'roulette:v2:history',
    lock: 'roulette:v2:lock',
};

// compare-and-set on the round's version, so a write can never clobber a newer one
const SAVE_ROUND = `
local cur = redis.call('GET', KEYS[1])
local expected = tonumber(ARGV[2])
if cur then
  if cjson.decode(cur).version ~= expected then return 0 end
elseif expected ~= 0 then return 0 end
redis.call('SET', KEYS[1], ARGV[1])
return 1`;

const UNLOCK = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;

const parse = <T>(v: unknown): T => (typeof v === 'string' ? JSON.parse(v) : v) as T;

export const kvStore: Store = {
    async getConfig() {
        const saved = await kv.get<RouletteConfig>(K.config);
        if (saved) return { ...DEFAULT_CONFIG, ...saved };
        // until an admin saves v2 settings, keep the v1 game's round and lock lengths
        const [roundMs, lockMs] = await kv.mget<[number | null, number | null]>('spin:round_duration', 'spin:lock_duration');
        return { ...DEFAULT_CONFIG, ...(roundMs ? { roundMs } : {}), ...(lockMs ? { lockMs } : {}) };
    },
    async setConfig(config) { await kv.set(K.config, config); },
    async getStats() {
        const saved = await kv.get<RouletteStats>(K.stats);
        if (saved) return saved;
        // the first v2 round inherits the v1 game's record pot
        const [ath, previous] = await kv.mget<[number | null, number | null]>('spin:ath_total_amount', 'spin:previous_round_amount');
        return { athTotal: String(ath ?? 0), previousTotal: String(previous ?? 0) };
    },
    async setStats(stats) { await kv.set(K.stats, stats); },
    getCurrentId: () => kv.get<string>(K.current),
    async setCurrentId(id) { await kv.set(K.current, id); },
    getRound: id => kv.get<Round>(K.round(id)),
    async saveRound(round) {
        return (await kv.eval(SAVE_ROUND, [K.round(round.id)], [JSON.stringify(round), String(round.version - 1)])) === 1;
    },
    async getBets(roundId) {
        const all = await kv.hgetall<Record<string, unknown>>(K.bets(roundId));
        return Object.values(all ?? {}).map(v => parse<Bet>(v));
    },
    async getBet(roundId, uuid) {
        const v = await kv.hget<unknown>(K.bets(roundId), uuid);
        return v ? parse<Bet>(v) : null;
    },
    async addBet(roundId, bet) {
        return (await kv.hsetnx(K.bets(roundId), bet.uuid, JSON.stringify(bet))) === 1;
    },
    async putBet(roundId, bet) { await kv.hset(K.bets(roundId), { [bet.uuid]: JSON.stringify(bet) }); },
    history: limit => kv.zrange<string[]>(K.history, 0, limit - 1, { rev: true }),
    async addHistory(id, endsAt) { await kv.zadd(K.history, { score: endsAt, member: id }); },
    async lock(ttlMs) {
        const token = randomBytes(16).toString('hex');
        return (await kv.set(K.lock, token, { nx: true, px: ttlMs })) === 'OK' ? token : null;
    },
    async unlock(token) { await kv.eval(UNLOCK, [K.lock], [token]); },
    async once(key) { return (await kv.set(`roulette:v2:once:${key}`, Date.now(), { nx: true })) === 'OK'; },
};

/** In-memory store with the same semantics, for tests. */
export function memoryStore(): Store & { rounds: Map<string, Round>; bets: Map<string, Map<string, Bet>> } {
    const rounds = new Map<string, Round>();
    const bets = new Map<string, Map<string, Bet>>();
    const history = new Map<string, number>();
    let config: RouletteConfig = DEFAULT_CONFIG;
    let stats: RouletteStats = { athTotal: '0', previousTotal: '0' };
    let current: string | null = null;
    let lockToken: string | null = null;
    const claimed = new Set<string>();
    const betsOf = (id: string) => bets.get(id) ?? bets.set(id, new Map()).get(id)!;
    const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    return {
        rounds, bets,
        getConfig: async () => clone(config),
        setConfig: async c => { config = clone(c); },
        getStats: async () => clone(stats),
        setStats: async s => { stats = clone(s); },
        getCurrentId: async () => current,
        setCurrentId: async id => { current = id; },
        getRound: async id => (rounds.has(id) ? clone(rounds.get(id)!) : null),
        saveRound: async round => {
            const cur = rounds.get(round.id);
            if ((cur ? cur.version : 0) !== round.version - 1) return false;
            rounds.set(round.id, clone(round));
            return true;
        },
        getBets: async id => [...betsOf(id).values()].map(clone),
        getBet: async (id, uuid) => (betsOf(id).has(uuid) ? clone(betsOf(id).get(uuid)!) : null),
        addBet: async (id, bet) => {
            if (betsOf(id).has(bet.uuid)) return false;
            betsOf(id).set(bet.uuid, clone(bet));
            return true;
        },
        putBet: async (id, bet) => { betsOf(id).set(bet.uuid, clone(bet)); },
        history: async limit => [...history.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id),
        addHistory: async (id, endsAt) => { history.set(id, endsAt); },
        lock: async () => {
            if (lockToken) return null;
            lockToken = randomBytes(8).toString('hex');
            return lockToken;
        },
        unlock: async token => { if (lockToken === token) lockToken = null; },
        once: async key => { if (claimed.has(key)) return false; claimed.add(key); return true; },
    };
}
