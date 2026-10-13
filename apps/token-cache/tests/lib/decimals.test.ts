import { describe, expect, it, vi } from 'vitest'

// Stand-ins for the chain and for every metadata source, set per test by `world`
const read = vi.hoisted(() => vi.fn())
vi.mock('@repo/polyglot', () => ({ callReadOnlyFunction: read, getContractInterface: vi.fn(async () => null) }))

import { kv } from '@vercel/kv'
import { Cryptonomicon, isValidDecimals } from '@/lib/cryptonomicon'
import { getTokenData } from '@/lib/tokenService'

const CHA = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
const CHA_SUBNET = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1'

/**
 * The chain answers get-decimals with `onChain` (undefined: it can't be read, as when Hiro rate-limits), and subnet
 * contracts have no get-decimals of their own. Every metadata source, the metadata API and each token's own JSON,
 * claims `claimed` decimals (undefined: it says nothing about them).
 */
function world(onChain: string | undefined, claimed: number | undefined = 8) {
    read.mockImplementation(async (_address: string, name: string, fn: string) => {
        if (fn === 'get-decimals') return onChain === undefined || name.includes('subnet') ? null : { type: 'uint', value: onChain }
        if (fn === 'get-token-uri') return { value: { value: `https://example.com/${name}.json` } }
        return null
    })
    const claims = { name: 'Charisma', symbol: 'CHA', decimals: claimed, image: 'https://example.com/cha.png' }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        headers: { get: () => (url.endsWith('.png') ? 'image/png' : 'application/json') },
        json: async () => (url.includes('subnet') ? { ...claims, type: 'SUBNET', base: CHA } : claims),
    })))
}

describe('token decimals', () => {
    it('come from the contract, whatever the metadata says', async () => {
        world('6')
        expect((await new Cryptonomicon().getTokenMetadata(CHA))?.decimals).toBe(6)
    })

    it('are never guessed when the contract can\'t be read', async () => {
        world(undefined)
        expect((await new Cryptonomicon().getTokenMetadata(CHA))?.decimals).toBeUndefined()
        world(undefined, undefined)
        expect((await new Cryptonomicon().getTokenMetadata(CHA))?.decimals).toBeUndefined()
    })

    it('can be zero', async () => {
        world('0')
        expect((await new Cryptonomicon().getTokenMetadata(CHA))?.decimals).toBe(0)
    })

    it('aren\'t cached when the contract can\'t be read, so the next look tries again', async () => {
        world(undefined)
        expect((await getTokenData(CHA))?.decimals).toBeUndefined()
        expect(kv.set).not.toHaveBeenCalled()
        world('6')
        expect((await getTokenData(CHA))?.decimals).toBe(6)
        expect(kv.set).toHaveBeenCalledWith(expect.stringContaining(CHA), expect.objectContaining({ decimals: 6 }), expect.anything())
    })

    it('are the base token\'s for a subnet, which holds the base token', async () => {
        world('6')
        expect((await getTokenData(CHA_SUBNET))?.decimals).toBe(6)
    })

    it('must be a whole number from 0 to 38, as a uint128 amount holds 38 digits', () => {
        expect([0, 6, 8, 38].every(isValidDecimals)).toBe(true)
        expect([-1, 39, 6.5, '6', null, undefined, NaN].some(isValidDecimals)).toBe(false)
    })
})
