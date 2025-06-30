/**
 * Token Metadata Configuration
 * Contains all constants and configuration for the token metadata system
 */

// Forward declaration for EnhancedTokenMetadata (to avoid circular imports)
interface EnhancedTokenMetadata {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  type?: 'SIP10' | 'SUBNET' | 'LP';
  description?: string;
  image?: string;
  verified?: boolean;
}

// Token source configuration interface
export interface TokenSource {
  name: string;
  url: string;
  priority: number; // Higher = more trusted
  timeout: number;
  enabled: boolean;
}

/**
 * Get environment-aware token source configuration
 * Simple: dev or not-dev
 */
export function getTokenSources(): TokenSource[] {
  const isDev = process.env.NODE_ENV === 'development';

  const sources: TokenSource[] = [
    {
      name: 'dex-cache-primary',
      url: isDev
        ? 'http://localhost:3003/api/v1/tokens/all?includePricing=true'
        : 'https://invest.charisma.rocks/api/v1/tokens/all?includePricing=true',
      priority: 100,
      timeout: isDev ? 15000 : 10000,
      enabled: true
    },
    {
      name: 'dex-cache-secondary',
      url: isDev
        ? 'http://localhost:3003/api/v1/tokens/all'
        : 'https://invest.charisma.rocks/api/v1/tokens/all',
      priority: 90,
      timeout: isDev ? 15000 : 10000,
      enabled: true
    },
    {
      name: 'simple-swap-api',
      url: isDev
        ? 'http://localhost:3002/api/token-summaries'
        : 'https://swap.charisma.rocks/api/token-summaries',
      priority: 80,
      timeout: isDev ? 12000 : 8000,
      enabled: true
    },
    {
      name: 'token-cache',
      url: isDev
        ? 'http://localhost:3000/api/v1/tokens'
        : 'https://tokens.charisma.rocks/api/v1/tokens',
      priority: 60,
      timeout: 8000,
      enabled: true
    }
  ];

  // Add local dev source if configured (highest priority in dev)
  if (isDev && (process.env.TOKEN_SUMMARIES_URL || process.env.NEXT_PUBLIC_TOKEN_SUMMARIES_URL)) {
    sources.push({
      name: 'local-dev',
      url: process.env.TOKEN_SUMMARIES_URL || process.env.NEXT_PUBLIC_TOKEN_SUMMARIES_URL!,
      priority: 110,
      timeout: 5000,
      enabled: true
    });
  }

  return sources
    .filter(source => source.enabled)
    .sort((a, b) => b.priority - a.priority);
}

// Known critical tokens that should always be included
export const CRITICAL_TOKENS = new Map<string, Partial<EnhancedTokenMetadata>>([
  ['.stx', {
    contractId: '.stx',
    name: 'Stacks Token',
    symbol: 'STX',
    decimals: 6,
    type: 'SIP10',
    description: 'The native token of the Stacks blockchain.',
    image: 'https://charisma.rocks/stx-logo.png',
    verified: true
  }],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token', {
    contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
    name: 'Charisma',
    symbol: 'CHA',
    decimals: 6,
    type: 'SIP10',
    verified: true
  }]
]);

// Subnet token mappings (from blaze-sdk)
export const SUBNET_MAPPINGS = new Map([
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.leo-token-subnet-v1',
    'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.kangaroo-subnet',
    'SP2C1WREHGM75C7TGFAEJPFKTFTEGZKF6DFT6E2GE.kangaroo'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1',
    'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.usda-token-subnet',
    'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken-subnet',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.nope-subnet',
    'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope'],
  ['SP2KGJEAZRDVK78ZWTRGSDE11A1VMZVEATNQFZ73C.world-peace-stacks-stxcity-subnet',
    'SP14J806BWEPQAXVA0G6RYZN7GNA126B7JFRRYTEM.world-peace-stacks-stxcity']
]);

// Default timeouts for different environments
export const DEFAULT_TIMEOUTS = {
  development: {
    dexCache: 15000,
    simpleSwap: 12000,
    tokenCache: 8000,
    localDev: 5000
  },
  production: {
    dexCache: 10000,
    simpleSwap: 8000,
    tokenCache: 8000,
    localDev: 5000
  }
} as const;

// API endpoint patterns
export const API_ENDPOINTS = {
  dexCache: {
    withPricing: '/api/v1/tokens/all?includePricing=true',
    withoutPricing: '/api/v1/tokens/all'
  },
  simpleSwap: {
    tokenSummaries: '/api/token-summaries'
  },
  tokenCache: {
    tokens: '/api/v1/tokens'
  }
} as const;

// Environment-specific base URLs
export const BASE_URLS = {
  development: {
    dexCache: 'http://localhost:3001',
    simpleSwap: 'http://localhost:3000',
    tokenCache: 'https://tokens.charisma.rocks'
  },
  production: {
    dexCache: 'https://invest.charisma.rocks',
    simpleSwap: 'https://swap.charisma.rocks',
    tokenCache: 'https://tokens.charisma.rocks'
  }
} as const;