import { describe, it, expect } from '@jest/globals';
import { getUserTokenBalance } from '..';

// Random sample tokens & addresses – they need not be valid because we are
// exercising the fallback path when the remote balance API is unavailable
// during tests (BASE_URL defaults to http://localhost:3005 which is inactive).
const samples = [
    {
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
        address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
    },
    {
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-rc6',
        address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
    },
    {
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
        address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
    },
    {
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.fake-token',
        address: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
    }
];

describe('getUserTokenBalance', () => {
    it('returns token balance data', async () => {
        const results = await Promise.all(
            samples.map(({ contractId, address }) => getUserTokenBalance(contractId, address)),
        );

        results.forEach((result, _idx) => {
            console.log(result);

            // Ensure types
            expect(typeof result.onChainBalance).toBe('string');
            expect(typeof result.pendingDiff).toBe('string');
            expect(typeof result.preconfirmationBalance).toBe('string');
        });
    });
}); 