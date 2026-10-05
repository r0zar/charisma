import { describe, expect, it } from 'vitest';
import type { MempoolTransaction } from '@stacks/stacks-blockchain-api-types';
import { Cl, getAddressFromPrivateKey, randomPrivateKey } from '@stacks/transactions';
import { signIntentWithPrivateKey } from 'blaze-sdk';
import type { Vault } from 'dexterity-sdk';
import { intentSigner } from '../blaze-signer';
import { effectsOf, STX, type DecodeDeps, type Effect } from './decode';
import fixtures from './__fixtures__/mempool.json';

type Fixture = (typeof fixtures.txs)[number];
const txs = fixtures.txs as unknown as (MempoolTransaction & Fixture)[];
const byId = (prefix: string) => txs.find(tx => tx.tx_id.startsWith(prefix))!;
const P = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

/** Each hop pays out what it really paid on the chain, so a route's likely amount is its real output */
function replaying(tx: Fixture): DecodeDeps {
    const paid = [...tx.tx_result.repr.matchAll(/\(dy u(\d+)\)/g)].map(m => BigInt(m[1]));
    let hop = 0;
    const vaults = new Map(fixtures.vaults.map(v => [v.contractId, v as unknown as Vault]));
    const bases = new Map(Object.entries(fixtures.bases).map(([id, base]) => [id, base === 'stx' ? STX : base]));
    return {
        baseOf: id => bases.get(id),
        vault: id => vaults.get(id),
        quote: async () => paid[hop++] ?? null,
        signer: intentSigner,
    };
}

const decode = (tx: MempoolTransaction & Fixture) => effectsOf(tx, replaying(tx));
const pick = (effects: Effect[], kind: string, sign: 1 | -1) => effects.find(e => e.kind === kind && (sign > 0 ? e.amount > 0n : e.amount < 0n));
const name = (token: string) => (token === STX ? STX : token.split('.')[1]);

describe('Reading transactions waiting to be mined', () => {
    it('charges the sender the network fee', async () => {
        const tx = byId('0xb58f61bf');
        const fee = (await decode(tx)).find(e => e.kind === 'fee')!;
        expect(fee).toMatchObject({ address: tx.sender_address, token: STX, amount: -BigInt(tx.fee_rate) });
    });

    it('reads a wallet swap: exactly what went in, the likely output, and the guaranteed least', async () => {
        const tx = byId('0x5184d3de'); // 2 STX into World Peace Stacks, two hops
        const effects = await decode(tx);
        expect(pick(effects, 'swap', -1)).toMatchObject({ address: tx.sender_address, token: STX, amount: -2_000_000n });
        const out = pick(effects, 'swap', 1)!;
        expect(name(out.token)).toBe('world-peace-stacks-stxcity');
        expect(out).toMatchObject({ address: tx.sender_address, amount: 720_274_626_378n, min: 684_260_895_059n });
    });

    it('debits the amount the sender signed, even when the pool forwards part of it as a fee', async () => {
        const tx = byId('0xb58f61bf'); // SHARK to STX through a pool that forwards an input fee
        const effects = await decode(tx);
        expect(pick(effects, 'swap', -1)).toMatchObject({ amount: -34_800_000_000n });
        expect(pick(effects, 'swap', 1)).toMatchObject({ token: STX, amount: 10_524_643n, min: 9_998_410n });
    });

    it('calls a route that only moves STX onto Blaze a deposit, not a trade', async () => {
        const tx = byId('0x5af1dc0b');
        const effects = (await decode(tx)).filter(e => e.kind !== 'fee');
        expect(effects.map(e => [e.kind, name(e.token), e.amount])).toEqual([
            ['deposit', STX, -10_000_000n],
            ['deposit', 'stx-subnet-v2', 10_000_000n],
        ]);
    });

    it('charges a Blaze order to the wallet that signed it, not the solver that sent it', async () => {
        for (const tx of txs.filter(t => /x-multihop-v[12]$/.test(t.contract_call.contract_id))) {
            const effects = await decode(tx);
            const paid = pick(effects, 'swap', -1)!;
            const got = pick(effects, 'swap', 1)!;
            // Signer-only routers pay the signer, so the recovered signer must be the payee
            expect(paid.address).toBe(got.address);
            expect(paid.address).not.toBe(tx.sender_address);
            // The solver pays the network fee
            expect(effects.find(e => e.kind === 'fee')!.address).toBe(tx.sender_address);
            const signed = tx.contract_call.function_args.find(a => a.name === 'in')!.repr.match(/\(amount u(\d+)\)/)![1];
            expect(paid.amount).toBe(-BigInt(signed));
        }
    });

    it('reads moving onto Blaze and back to Stacks as exact amounts on both sides', async () => {
        const deposit = await decode(byId('0x18db1d3b'));
        expect(deposit.filter(e => e.kind === 'deposit').map(e => [name(e.token), e.amount])).toEqual([
            ['charisma-token', -3_560_281n],
            ['charisma-token-subnet-v1', 3_560_281n],
        ]);
        const withdraw = await decode(byId('0x07155676'));
        expect(withdraw.filter(e => e.kind === 'withdraw').map(e => [name(e.token), e.amount])).toEqual([
            ['welsh-token-subnet-v1', -1_000_000_000n],
            ['welshcorgicoin-token', 1_000_000_000n],
        ]);
    });

    it('reads a subnet transfer between two wallets', async () => {
        const effects = (await decode(byId('0xd19d958f'))).filter(e => e.kind === 'transfer');
        expect(effects.map(e => [e.address, e.amount])).toEqual([[P, -1n], ['SP3619DGWH08262BJAG0NPFHZQDPN4TKMXHC0ZQDN', 1n]]);
    });

    it('recovers who signed a Blaze transfer someone else sent', async () => {
        const key = randomPrivateKey();
        const signer = getAddressFromPrivateKey(key, 'mainnet');
        const subnet = `${P}.charisma-token-subnet-v2`;
        const to = 'SP3619DGWH08262BJAG0NPFHZQDPN4TKMXHC0ZQDN';
        const uuid = '7f0c1f4e-2b8a-4c55-9d3e-1a2b3c4d5e6f';
        const { signature } = await signIntentWithPrivateKey({ contract: subnet, intent: 'TRANSFER_TOKENS', amount: 2_500_000, target: to, uuid, senderKey: key });
        const arg = (name: string, value: Parameters<typeof Cl.serialize>[0]) => ({ name, hex: Cl.serialize(value), repr: '', type: '' });
        const tx = {
            tx_id: '0xsigned', tx_type: 'contract_call', tx_status: 'pending', receipt_time: 0, sender_address: 'SP3619DGWH08262BJAG0NPFHZQDPN4TKMXHC0ZQDN',
            sponsored: false, fee_rate: '0', nonce: 0, post_condition_mode: 'deny', post_conditions: [],
            contract_call: { contract_id: subnet, function_name: 'x-transfer', function_signature: '', function_args: [
                arg('signature', Cl.bufferFromHex(signature)), arg('amount', Cl.uint(2_500_000)), arg('uuid', Cl.stringAscii(uuid)), arg('to', Cl.principal(to)),
            ] },
        } as unknown as MempoolTransaction;
        const deps = replaying(byId('0xd19d958f'));
        const effects = await effectsOf(tx, { ...deps, baseOf: id => (id === subnet ? `${P}.charisma-token` : deps.baseOf(id)) });
        expect(effects.map(e => [e.address, e.amount])).toEqual([[signer, -2_500_000n], [to, 2_500_000n]]);
    });

    it("counts a wrapped-STX transfer as the real STX it moves", async () => {
        const alex = 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-wstx';
        const [from, to] = [P, 'SP3619DGWH08262BJAG0NPFHZQDPN4TKMXHC0ZQDN'];
        const tx = {
            ...byId('0xd19d958f'),
            fee_rate: '0',
            contract_call: { contract_id: alex, function_name: 'transfer', function_args: [Cl.uint(150_000_000), Cl.principal(from), Cl.principal(to), Cl.none()]
                .map((cv, i) => ({ name: ['amount', 'sender', 'recipient', 'memo'][i], hex: Cl.serialize(cv), repr: '', type: '' })) },
        };
        // 1.5 STX, counted in ALEX's 8 decimals
        expect((await decode(tx as unknown as MempoolTransaction & Fixture)).map(e => [e.token, e.amount])).toEqual([[STX, -1_500_000n], [STX, 1_500_000n]]);
    });

    it('leaves contracts it does not know alone, apart from the fee', async () => {
        const tx = { ...byId('0xb58f61bf'), contract_call: { ...byId('0xb58f61bf').contract_call, contract_id: 'SP000000000000000000002Q6VF78.pox-4', function_name: 'delegate-stx' } };
        expect((await decode(tx as MempoolTransaction & Fixture)).map(e => e.kind)).toEqual(['fee']);
    });
});
