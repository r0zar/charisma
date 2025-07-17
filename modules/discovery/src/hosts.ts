/**
 * Host Registry
 * Contains all known hosts with their development and production URLs
 */

interface HostUrls {
  development: string;
  production: string;
}

export const HOSTS: Record<string, HostUrls> = {
  'party': {
    development: 'http://localhost:1999',
    production: 'https://charisma-party.r0zar.partykit.dev'
  },
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
  'tx-monitor': {
    development: 'http://localhost:3012',
    production: 'https://tx.charisma.rocks'
  }
} as const;