import type { Metadata } from 'next';

const title = 'Blaze Wallet | The Blaze wallet for Stacks';
const description = 'Connect to any Stacks app, sign and send, with Blaze subnets built in. Your keys never leave your browser.';

export const metadata: Metadata = {
  title,
  description,
  icons: { icon: '/wallet/icon.png' },
  openGraph: { title, description, siteName: 'Blaze Wallet', type: 'website', images: ['/wallet/icon.png'] },
};

/** The wallet's HUD look: near-black, teal mesh */
export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: '#010409',
        backgroundImage: `
          linear-gradient(to right, rgba(125, 249, 255, 0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(125, 249, 255, 0.05) 1px, transparent 1px)`,
        backgroundSize: '20px 20px',
      }}
    >
      {children}
    </div>
  );
}
