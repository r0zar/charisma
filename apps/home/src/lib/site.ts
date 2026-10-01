export const LINKS = {
  swap: 'https://swap.charisma.rocks',
  docs: 'https://docs.charisma.rocks',
  brand: 'https://brand.charisma.rocks',
  analytics: 'https://swap.charisma.rocks/analytics',
  github: 'https://github.com/r0zar/charisma',
  discord: 'https://discord.gg/ZvDmqQskpy',
  x: 'https://x.com/CharismaBTC',
} as const;

export type App = { name: string; endorsed?: boolean; host: string; href: string; blurb: string; tag?: string };

/** Every live Charisma app, grouped the way people use them */
export const APP_GROUPS: { title: string; note: string; apps: App[] }[] = [
  {
    title: 'Trade', note: 'Swap anything, or play the market in a few taps.', apps: [
      { name: 'Swap', host: 'swap.charisma.rocks', href: 'https://swap.charisma.rocks', blurb: 'The best price across every pool and route. Swap from your wallet, or off chain in an instant.' },
      { name: 'Zesty', endorsed: true, host: 'zesty.charisma.rocks', href: 'https://zesty.charisma.rocks', blurb: 'Pick a side on ZEST, set a price and a safety net, and walk away. Zesty finishes it for you.' },
      { name: 'Meme Roulette', endorsed: true, host: 'lol.charisma.rocks', href: 'https://lol.charisma.rocks', blurb: 'Commit CHA with everyone else, and the round pumps one meme token together.' },
    ],
  },
  {
    title: 'Earn', note: 'Put idle tokens to work.', apps: [
      { name: 'Invest', host: 'invest.charisma.rocks', href: 'https://invest.charisma.rocks', blurb: 'Liquidity pools, subnets and hold-to-earn: the place on Stacks to earn yield.' },
    ],
  },
  {
    title: 'Wallet and automation', note: 'Sign once; let it run.', apps: [
      { name: 'Blaze Wallet', endorsed: true, host: 'wallet.charisma.rocks', href: 'https://wallet.charisma.rocks', blurb: 'The wallet for Stacks and Blaze subnets. See exactly what you’re approving before you sign.', tag: 'Coming soon' },
      { name: 'Tokemon', endorsed: true, host: 'bots.charisma.rocks', href: 'https://bots.charisma.rocks', blurb: 'Run and watch your trading bots in one place.', tag: 'Coming soon' },
    ],
  },
  {
    title: 'Build', note: 'Launch, describe and watch on-chain things.', apps: [
      { name: 'Launchpad', host: 'launchpad.charisma.rocks', href: 'https://launchpad.charisma.rocks', blurb: 'Launch SIP-010 tokens and liquidity pools from templates. No code required.' },
      { name: 'Tokens', host: 'tokens.charisma.rocks', href: 'https://tokens.charisma.rocks', blurb: 'Token data for every SIP-010 on Stacks, with an open API.' },
      { name: 'Metadata', host: 'metadata.charisma.rocks', href: 'https://metadata.charisma.rocks', blurb: 'Create, update and host your token’s metadata and images.' },
      { name: 'TX Monitor', host: 'tx.charisma.rocks', href: 'https://tx.charisma.rocks', blurb: 'A queue-based API that tracks transaction status on Stacks.' },
      { name: 'Lakehouse', endorsed: true, host: 'lakehouse.charisma.rocks', href: 'https://lakehouse.charisma.rocks', blurb: 'A live 3D map of the Stacks network, plus a data API.' },
      { name: 'Docs', host: 'docs.charisma.rocks', href: 'https://docs.charisma.rocks', blurb: 'Guides and API references for building Bitcoin DeFi on Stacks.' },
    ],
  },
];
