import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const EDIT_URL = 'https://github.com/r0zar/charisma/tree/main/apps/docs/';

const config: Config = {
  title: 'Charisma Docs',
  tagline: 'Build Bitcoin DeFi on Stacks',
  favicon: 'img/favicon.ico',
  url: 'https://docs.charisma.rocks',
  baseUrl: '/',
  organizationName: 'r0zar',
  projectName: 'charisma',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  // ```mermaid code blocks render as diagrams
  markdown: { mermaid: true },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: EDIT_URL,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/charisma-docs-card.png',
    // System by default: the toggle cycles System → Light · Bitcoin → Dark · RPG, like every Charisma app
    colorMode: {
      respectPrefersColorScheme: true,
    },
    mermaid: {
      theme: { light: 'neutral', dark: 'dark' },
      options: { fontFamily: 'var(--font-sans)' },
    },
    navbar: {
      title: 'Charisma',
      logo: {
        alt: 'Charisma',
        src: 'img/charisma.png',
      },
      items: [
        { type: 'doc', docId: 'intro', position: 'left', label: 'Start here' },
        { type: 'docSidebar', sidebarId: 'dexSidebar', position: 'left', label: 'DEX API' },
        { type: 'docSidebar', sidebarId: 'blazeSidebar', position: 'left', label: 'Blaze' },
        { type: 'docSidebar', sidebarId: 'dexteritySidebar', position: 'left', label: 'Dexterity' },
        { type: 'docSidebar', sidebarId: 'pricesSidebar', position: 'left', label: 'Prices' },
        { type: 'docSidebar', sidebarId: 'dataApisSidebar', position: 'left', label: 'Data APIs' },
        { type: 'docSidebar', sidebarId: 'tokenomicsSidebar', position: 'left', label: 'Tokenomics' },
        { href: 'https://github.com/r0zar/charisma', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Start here', to: '/docs/intro' },
            { label: 'DEX API', to: '/docs/dex-api/overview' },
            { label: 'Blaze', to: '/docs/blaze-api/introduction' },
            { label: 'Dexterity', to: '/docs/dexterity/overview' },
            { label: 'Prices', to: '/docs/prices/overview' },
            { label: 'Data APIs', to: '/docs/data-apis/overview' },
            { label: 'Tokenomics', to: '/docs/tokenomics/cha' },
          ],
        },
        {
          title: 'Apps',
          items: [
            { label: 'Charisma Swap', href: 'https://swap.charisma.rocks' },
            { label: 'Charisma Invest', href: 'https://invest.charisma.rocks' },
            { label: 'Charisma Launchpad', href: 'https://launchpad.charisma.rocks' },
            { label: 'Brand', href: 'https://brand.charisma.rocks' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'Discord', href: 'https://discord.gg/ZvDmqQskpy' },
            { label: 'X', href: 'https://x.com/CharismaBTC' },
            { label: 'GitHub', href: 'https://github.com/r0zar/charisma' },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Charisma`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
