import { expect, it, vi } from 'vitest'

const getAllMetadata = vi.hoisted(() => vi.fn())
vi.mock('@/lib/tokenService', () => ({ getAllMetadata }))

import { GET } from '@/app/api/v1/sip10/route'

it('lists only tokens whose decimals a real token can have', async () => {
    getAllMetadata.mockResolvedValue([
        { contractId: 'SP1.six', symbol: 'SIX', decimals: 6 },
        { contractId: 'SP1.text', symbol: 'TEXT', decimals: '6' },
        { contractId: 'SP1.none', symbol: 'NONE' },
        { contractId: 'SP1.huge', symbol: 'HUGE', decimals: 39 },
        { contractId: 'SP1.zero', symbol: 'ZERO', decimals: 0 },
    ])
    const response = await GET(new Request('https://tokens.charisma.rocks/api/v1/sip10') as never)
    expect((await response.json()).map((token: { contractId: string }) => token.contractId)).toEqual(['SP1.six', 'SP1.zero'])
})
