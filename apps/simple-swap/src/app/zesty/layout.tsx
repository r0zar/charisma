import type { Metadata } from 'next';
import './zesty.css';

const title = 'Zesty | Trade ZEST in three taps';
const description = 'Think ZEST goes up or down? Pick a side, pick how much, walk away. Zesty sells for you, even while you sleep.';

// The preview image comes from opengraph-image.tsx and covers every Zesty page
export const metadata: Metadata = {
  metadataBase: new URL('https://zesty.charisma.rocks'),
  title,
  description,
  openGraph: { title, description, url: 'https://zesty.charisma.rocks', siteName: 'Zesty', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
};

export default function ZestyLayout({ children }: { children: React.ReactNode }) {
  return <div className="zesty">{children}</div>;
}
