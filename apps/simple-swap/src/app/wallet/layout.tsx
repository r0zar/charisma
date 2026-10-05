import type { Metadata } from 'next';
import Link from 'next/link';
import { ThemeToggle } from '@repo/brand/react';
import { BLAZE_WALLET_STORE_URL } from './links';

const title = 'Blaze Wallet | Do more on Stacks';
const description = 'Do more on Stacks. Sign once for limit orders and scheduled buys that run on their own, settled on-chain and paid only to you.';

export const metadata: Metadata = {
  title,
  description,
  icons: { icon: '/wallet/flame.svg' },
  openGraph: { title, description, siteName: 'Blaze Wallet', type: 'website', images: [{ url: '/wallet/og.png', width: 1400, height: 560 }] },
  twitter: { card: 'summary_large_image', title, description, images: ['/wallet/og.png'] },
};

/** wallet.charisma.rocks: Blaze Wallet's site, in Charisma's look, with a black header and footer like the other apps */
export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <header className="border-b border-line bg-chrome text-on-chrome">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/wallet" className="flex flex-1 items-center gap-2.5 text-lg font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wallet/flame.svg" alt="" className="h-7 w-7" />
            Blaze Wallet <span className="hidden text-sm font-normal text-on-chrome-muted sm:inline">by Charisma</span>
          </Link>
          <ThemeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-on-chrome-muted transition-colors hover:bg-on-chrome/10 hover:text-on-chrome" />
          <a href={BLAZE_WALLET_STORE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover">
            Add to Chrome
          </a>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-line bg-chrome text-on-chrome-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm sm:flex-row sm:px-6">
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wallet/flame.svg" alt="" className="h-5 w-5" />
            <span className="font-semibold text-on-chrome">Blaze Wallet</span> by Charisma
          </span>
          <nav className="flex gap-5">
            <Link href="/wallet/privacy" className="hover:text-on-chrome">Privacy</Link>
            <a href="https://github.com/r0zar/charisma/issues" className="hover:text-on-chrome">Support</a>
            <a href="https://swap.charisma.rocks" className="hover:text-on-chrome">Charisma Swap</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
