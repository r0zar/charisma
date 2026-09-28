import type { Metadata } from 'next';
import './zesty.css';

export const metadata: Metadata = {
  title: 'Zesty | Trade ZEST in three taps',
  description: 'Think ZEST goes up or down? Set it and walk away. Zesty finishes the trade for you, even while you sleep.',
};

export default function ZestyLayout({ children }: { children: React.ReactNode }) {
  return <div className="zesty">{children}</div>;
}
