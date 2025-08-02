/**
 * Host Registry
 * Contains all known hosts with their development and production URLs
 */

interface HostUrls {
  development: string;
  production: string;
  test: string;
}

export const HOSTS: Record<string, HostUrls> = {
  'tokens': {
    development: 'http://localhost:3000',
    production: 'https://tokens.charisma.rocks',
    test: 'http://localhost:3000'
  },
  'swap': {
    development: 'http://localhost:3002',
    production: 'https://swap.charisma.rocks',
    test: 'http://localhost:3002'
  },
  'invest': {
    development: 'http://localhost:3003',
    production: 'https://invest.charisma.rocks',
    test: 'http://localhost:3003'
  },
  'contract-registry': {
    development: 'http://localhost:3600',
    production: 'https://contracts.charisma.rocks',
    test: 'http://localhost:3600'
  },
  'tx-monitor': {
    development: 'http://localhost:3012',
    production: 'https://tx.charisma.rocks',
    test: 'http://localhost:3012'
  },
  'prices': {
    development: 'http://localhost:3500',
    production: 'https://prices.charisma.rocks',
    test: 'http://localhost:3500'
  },
  'lottery': {
    development: 'http://localhost:3013',
    production: 'https://lottery.charisma.rocks',
    test: 'http://localhost:3013'
  },
  'lakehouse': {
    development: 'https://lakehouse.charisma.rocks',
    production: 'https://lakehouse.charisma.rocks',
    test: 'https://lakehouse.charisma.rocks'
  }
} as const;