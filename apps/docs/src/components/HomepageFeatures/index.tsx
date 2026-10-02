import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type Section = { title: string; to: string; description: string };

const SECTIONS: Section[] = [
  { title: 'DEX API', to: '/docs/dex-api/overview', description: 'Quotes, signed orders, cancel and execute, API keys.' },
  { title: 'Blaze', to: '/docs/blaze-api/introduction', description: 'Signed intents, subnet tokens, swap routers and the trust model.' },
  { title: 'Prices', to: '/docs/prices/overview', description: 'How every token gets a USD price, and the API that serves it.' },
  { title: 'Data APIs', to: '/docs/data-apis/overview', description: 'Tokens, vaults, metadata and balances, open to read.' },
  { title: 'Tokenomics', to: '/docs/tokenomics/cha', description: 'CHA, Hold-to-Earn and who can change what.' },
  { title: 'Start here', to: '/docs/intro', description: 'The Charisma apps, where they live and where to begin.' },
];

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.grid}>
          {SECTIONS.map(({ title, to, description }) => (
            <Link key={to} to={to} className={styles.card}>
              <Heading as="h3">{title}</Heading>
              <p>{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
