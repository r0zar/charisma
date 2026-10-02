import { describe, expect, it } from 'vitest';
import { SUBNET_PAIRS, isListedSubnet, landingSubnet, pairOf, planSpend } from './subnet-pairs';

const P = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';
const [CHA, WELSH, SBTC] = SUBNET_PAIRS;

describe('CHA, WELSH and sBTC across Blaze v1 and v2', () => {
    it('pairs each v1 subnet with its v2 successor', () => {
        expect(SUBNET_PAIRS.map(p => [p.symbol, p.v1, p.v2])).toEqual([
            ['CHA', `${P}.charisma-token-subnet-v1`, `${P}.charisma-token-subnet-v2`],
            ['WELSH', `${P}.welsh-token-subnet-v1`, `${P}.welsh-token-subnet-v2`],
            ['sBTC', `${P}.sbtc-token-subnet-v1`, `${P}.sbtc-token-subnet-v2`],
        ]);
    });

    it('spends the old subnet first', () => {
        expect(planSpend(CHA, 50n, 100n, 100n).source).toBe(CHA.v1);
        expect(planSpend(CHA, 100n, 100n, 0n).source).toBe(CHA.v1);
    });

    it('moves to v2 once v1 can no longer cover the amount', () => {
        expect(planSpend(CHA, 150n, 100n, 200n).source).toBe(CHA.v2);
        expect(planSpend(CHA, 50n, 0n, 50n).source).toBe(CHA.v2);
    });

    it('says when the balance is split and suggests the upgrade', () => {
        expect(() => planSpend(CHA, 150n, 100n, 100n)).toThrow(/Upgrade your v1 CHA/);
        expect(() => planSpend(WELSH, 150n, 100n, 100n)).toThrow(/Upgrade your v1 WELSH/);
    });

    it('says when there is simply not enough, in the token and its decimals', () => {
        expect(() => planSpend(CHA, 500n, 100n, 100n)).toThrow('Not enough CHA: this needs 0.0005 and you have 0.0002.');
        expect(() => planSpend(SBTC, 500n, 100n, 100n)).toThrow('Not enough sBTC: this needs 0.000005 and you have 0.000002.');
    });

    it('tops up v2 from the wallet, never v1', () => {
        expect(planSpend(CHA, 100n, 100n, 0n, 50n)).toEqual({ source: CHA.v1, deposit: 0n });
        expect(planSpend(CHA, 150n, 100n, 40n, 200n)).toEqual({ source: CHA.v2, deposit: 110n });
        expect(planSpend(CHA, 150n, 0n, 0n, 150n)).toEqual({ source: CHA.v2, deposit: 150n });
        expect(() => planSpend(CHA, 150n, 100n, 40n, 50n)).toThrow(/Upgrade your v1 CHA/);
    });

    it('keeps each pair to its own subnets', () => {
        expect(planSpend(SBTC, 50n, 100n, 0n).source).toBe(SBTC.v1);
        expect(planSpend(WELSH, 50n, 0n, 100n).source).toBe(WELSH.v2);
        expect(pairOf(SBTC.v2)).toBe(SBTC);
        expect(pairOf(WELSH.v1)).toBe(WELSH);
        expect(pairOf(`${P}.leo-token-subnet-v1`)).toBeNull();
        expect(pairOf(null)).toBeNull();
    });

    it('lists only the v1 row, and lands payments in v2', () => {
        for (const p of SUBNET_PAIRS) {
            expect(isListedSubnet(p.v1)).toBe(true);
            expect(isListedSubnet(p.v2)).toBe(false);
            expect(landingSubnet(p.v1)).toBe(p.v2);
            expect(landingSubnet(p.v2)).toBe(p.v2);
        }
        expect(landingSubnet(`${P}.leo-token-subnet-v1`)).toBe(`${P}.leo-token-subnet-v1`);
    });
});
