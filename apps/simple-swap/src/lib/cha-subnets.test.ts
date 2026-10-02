import { describe, expect, it } from 'vitest';
import { CHA_SUBNET_V1, CHA_SUBNET_V2, chaPlan, isChaSubnet, isListedSubnet } from './cha-subnets';

describe('CHA across Blaze v1 and v2', () => {
    it('spends the old subnet first', () => {
        expect(chaPlan(50n, 100n, 100n).source).toBe(CHA_SUBNET_V1);
        expect(chaPlan(100n, 100n, 0n).source).toBe(CHA_SUBNET_V1);
    });

    it('moves to v2 once v1 can no longer cover the amount', () => {
        expect(chaPlan(150n, 100n, 200n).source).toBe(CHA_SUBNET_V2);
        expect(chaPlan(50n, 0n, 50n).source).toBe(CHA_SUBNET_V2);
    });

    it('says when the balance is split and suggests the upgrade', () => {
        expect(() => chaPlan(150n, 100n, 100n)).toThrow(/Upgrade your v1 CHA/);
    });

    it('says when there is simply not enough', () => {
        expect(() => chaPlan(500n, 100n, 100n)).toThrow('Not enough CHA: this needs 0.0005 and you have 0.0002.');
    });

    it('tops up v2 from the wallet, never v1', () => {
        expect(chaPlan(100n, 100n, 0n, 50n)).toEqual({ source: CHA_SUBNET_V1, deposit: 0n });
        expect(chaPlan(150n, 100n, 40n, 200n)).toEqual({ source: CHA_SUBNET_V2, deposit: 110n });
        expect(chaPlan(150n, 0n, 0n, 150n)).toEqual({ source: CHA_SUBNET_V2, deposit: 150n });
        expect(() => chaPlan(150n, 100n, 40n, 50n)).toThrow(/Upgrade your v1 CHA/);
    });

    it('knows both subnets, and lists only one', () => {
        expect(isChaSubnet(CHA_SUBNET_V1) && isChaSubnet(CHA_SUBNET_V2)).toBe(true);
        expect(isChaSubnet('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1')).toBe(false);
        expect(isListedSubnet(CHA_SUBNET_V1)).toBe(true);
        expect(isListedSubnet(CHA_SUBNET_V2)).toBe(false);
    });
});
