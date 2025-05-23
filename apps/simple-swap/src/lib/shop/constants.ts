// Shop marketplace constants
export const SHOP_CONTRACTS = {
    ENERGY: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy',
    HOOT_TOKEN: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-the-owl',
    HOOT_FARM: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hooter-farm-x10'
} as const;

// Shop item configuration
export const FEATURED_ITEMS = {
    HOOT_FARM: {
        id: 'hooter-farm',
        type: 'token' as const,
        title: 'HOOT Tokens',
        description: 'Spend up to 1000 energy to collect HOOT token rewards.',
        price: 100,
        maxQuantity: 10
    }
} as const;

// Shop categories and filters
export const SHOP_CATEGORIES = {
    ALL: 'all',
    NFT: 'nft',
    TOKEN: 'token',
    OFFER: 'offer'
} as const;

export const SORT_OPTIONS = {
    NEWEST: 'newest',
    PRICE_LOW: 'price-low',
    PRICE_HIGH: 'price-high'
} as const;

// Default filter ranges
export const DEFAULT_PRICE_RANGE: [number, number] = [0, 1000];

// OTC offer status
export const OFFER_STATUS = {
    OPEN: 'open',
    CLOSED: 'closed',
    CANCELLED: 'cancelled'
} as const; 