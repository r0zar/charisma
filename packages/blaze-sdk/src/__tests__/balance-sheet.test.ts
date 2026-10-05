import { describe, expect, it, vi } from 'vitest';
import { combineSubnets, getBalances, readEvents, watchBalances, type BalanceSheet } from '../balance-sheet';

const P = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

const sheet = (block: number, ready = '100'): BalanceSheet => ({
    address: P, block, at: block, failed: [],
    tokens: { '.stx': { settled: '100', pending: '0', held: '0', ready, entries: [] } },
});

/** A response body that arrives in the given pieces */
const body = (...pieces: string[]) => new ReadableStream<Uint8Array>({
    start(controller) {
        for (const piece of pieces) controller.enqueue(new TextEncoder().encode(piece));
        controller.close();
    },
});

const collect = async (stream: ReadableStream<Uint8Array>) => {
    const events = [];
    for await (const e of readEvents(stream)) events.push(e);
    return events;
};

describe('Instant balances in blaze-sdk', () => {
    it('reads server-sent events, however the network splits them', async () => {
        const events = await collect(body('retry: 1000\n\n: ping\n\nevent: sh', 'eet\ndata: {"a":', '1}\n\nevent: problem\r\ndata: line one\r\ndata: line two\r\n\r\n'));
        expect(events).toEqual([
            { event: 'sheet', data: '{"a":1}' },
            { event: 'problem', data: 'line one\nline two' },
        ]);
    });

    it('gets a sheet once, and explains when it cannot', async () => {
        const ok = vi.fn(async () => Response.json(sheet(7)));
        expect((await getBalances(P, { fetch: ok as unknown as typeof fetch })).block).toBe(7);
        expect(ok).toHaveBeenCalledWith(`https://swap.charisma.rocks/api/v1/balances/${P}/sheet`, expect.anything());

        const down = vi.fn(async () => Response.json({ message: 'Hiro is down' }, { status: 502 }));
        await expect(getBalances(P, { fetch: down as unknown as typeof fetch })).rejects.toThrow(/\(502\): Hiro is down/);
    });

    it('watches: every pushed sheet arrives, a closed stream reconnects, and stop ends it', async () => {
        const event = (s: BalanceSheet) => `event: sheet\ndata: ${JSON.stringify(s)}\n\n`;
        const streams = [body(event(sheet(1)), event(sheet(2))), body(event(sheet(3)))];
        const fakeFetch = vi.fn(async () => new Response(streams.shift() ?? new ReadableStream(), { status: 200 }));
        const seen: number[] = [];
        const stop = watchBalances(P, s => seen.push(s.block), { fetch: fakeFetch as unknown as typeof fetch });
        await vi.waitFor(() => expect(seen).toEqual([1, 2, 3]), { timeout: 4_000 });
        stop();
        expect(fakeFetch.mock.calls[0][0]).toBe(`https://swap.charisma.rocks/api/v1/balances/${P}/stream`);
    });

    it('reports problems and keeps watching', async () => {
        const problems: string[] = [];
        let calls = 0;
        const fakeFetch = vi.fn(async () => (++calls === 1
            ? Response.json({ message: 'busy' }, { status: 503 })
            : new Response(body('event: problem\ndata: {"message":"subnet unreadable"}\n\n'), { status: 200 })));
        const stop = watchBalances(P, () => {}, { fetch: fakeFetch as unknown as typeof fetch, onProblem: e => problems.push(e.message) });
        await vi.waitFor(() => expect(problems).toContain('subnet unreadable'), { timeout: 5_000 });
        stop();
        expect(problems[0]).toMatch(/\(503\): busy/);
    });

    it("adds a token's Stacks and Blaze sides together", () => {
        const cha = `${P}.charisma-token`;
        const combined = combineSubnets({
            ...sheet(1),
            tokens: {
                [cha]: { settled: '500', pending: '-100', held: '0', ready: '400', entries: [] },
                [`${P}.charisma-token-subnet-v1`]: { base: cha, settled: '50', pending: '0', held: '-20', ready: '30', entries: [] },
                [`${P}.charisma-token-subnet-v2`]: { base: cha, settled: '200', pending: '100', held: '0', ready: '300', entries: [] },
                [`${P}.welsh-token-subnet-v2`]: { base: `${P}.welshcorgicoin-token`, settled: null, error: 'timeout', pending: '0', held: '0', ready: null, entries: [] },
            },
        });
        expect(combined[cha]).toEqual({ settled: '750', pending: '0', held: '-20', ready: '730', tokens: [cha, `${P}.charisma-token-subnet-v1`, `${P}.charisma-token-subnet-v2`] });
        // A side that couldn't be read leaves the total unknown rather than guessed
        expect(combined[`${P}.welshcorgicoin-token`].ready).toBeNull();
    });
});
