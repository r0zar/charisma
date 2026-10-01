export const LINKS = {
  swap: 'https://swap.charisma.rocks',
  docs: 'https://docs.charisma.rocks',
  brand: 'https://brand.charisma.rocks',
  analytics: 'https://swap.charisma.rocks/analytics',
  github: 'https://github.com/r0zar/charisma',
  discord: 'https://discord.gg/ZvDmqQskpy',
  x: 'https://x.com/CharismaBTC',
} as const;

export type App = { name: string; href: string; line: string; soon?: boolean };

/** Every live Charisma app, grouped the way people use them. `line` is four or five words, no more. */
export const APP_GROUPS: { title: string; apps: App[] }[] = [
  {
    title: 'Trade', apps: [
      { name: 'Swap', href: 'https://swap.charisma.rocks', line: 'Best price on every swap' },
      { name: 'Zesty', href: 'https://zesty.charisma.rocks', line: 'Pick a side on ZEST' },
      { name: 'Meme Roulette', href: 'https://lol.charisma.rocks', line: 'Pump a meme together' },
    ],
  },
  {
    title: 'Earn', apps: [
      { name: 'Invest', href: 'https://invest.charisma.rocks', line: 'Earn from liquidity pools' },
    ],
  },
  {
    title: 'Wallet', apps: [
      { name: 'Blaze Wallet', href: 'https://wallet.charisma.rocks', line: 'The wallet for Blaze', soon: true },
      { name: 'Tokemon', href: 'https://bots.charisma.rocks', line: 'Your trading bots', soon: true },
    ],
  },
  {
    title: 'Build', apps: [
      { name: 'Launchpad', href: 'https://launchpad.charisma.rocks', line: 'Launch a token or pool' },
      { name: 'Tokens', href: 'https://tokens.charisma.rocks', line: 'Token data and API' },
      { name: 'Metadata', href: 'https://metadata.charisma.rocks', line: 'Host token metadata' },
      { name: 'TX Monitor', href: 'https://tx.charisma.rocks', line: 'Track any transaction' },
      { name: 'Lakehouse', href: 'https://lakehouse.charisma.rocks', line: 'A 3D map of Stacks' },
      { name: 'Docs', href: 'https://docs.charisma.rocks', line: 'Build on Charisma' },
    ],
  },
];
