/**
 * Host Registry
 * Contains all known hosts with their development and production URLs
 */

interface HostUrls {
  development: string;
  production: string;
}

export const HOSTS: Record<string, HostUrls> = {
  'tokens': {
    development: 'http://localhost:3000',
    production: 'https://tokens.charisma.rocks'
  },
  'swap': {
    development: 'http://localhost:3002',
    production: 'https://swap.charisma.rocks'
  },
  'invest': {
    development: 'http://localhost:3003',
    production: 'https://invest.charisma.rocks'
  },
  'contract-registry': {
    development: 'http://localhost:3600',
    production: 'https://contracts.charisma.rocks'
  },
  'tx-monitor': {
    development: 'http://localhost:3012',
    production: 'https://tx.charisma.rocks'
  },
  'prices': {
    development: 'http://localhost:3500',
    production: 'https://prices.charisma.rocks'
  }
} as const;