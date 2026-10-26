import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blaze Wallet privacy policy',
  description: 'What Blaze Wallet, the browser extension and the iPhone app, stores, what it sends, and to whom.',
};

const UPDATED = 'October 26, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function BlazeWalletPrivacy() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-12 text-[15px] leading-relaxed">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Blaze Wallet privacy policy</h1>
        <p className="text-muted-foreground">Last updated {UPDATED}</p>
        <p>
          Blaze Wallet is a self-custody wallet for the Stacks blockchain, made by Charisma, as a browser extension and an
          iPhone app. It has no accounts, no analytics and no tracking, and we never sell data. This page lists
          everything it stores and every place it sends information.
        </p>
      </header>

      <Section title="What stays on your device">
        <p><strong>In the browser extension:</strong></p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Your seed phrases and private keys</strong>, encrypted with your password (AES-GCM with a key derived
            by PBKDF2-SHA256, 600,000 rounds) in the extension&apos;s local storage. Your password is never stored.
          </li>
          <li>
            <strong>While unlocked</strong>, the encryption key is kept in the browser&apos;s session memory, which is
            cleared when the browser closes or after 15 minutes without use.
          </li>
          <li>Account names and which account is active, inside the same encrypted vault.</li>
        </ul>
        <p><strong>In the iPhone app:</strong></p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Your seed phrases, private keys and accounts</strong> in one item in the iPhone&apos;s Keychain. Reading
            it takes Face ID or your passcode, and it stays on that iPhone: it&apos;s never in a backup and never moves to
            another device.
          </li>
          <li>
            <strong>While unlocked</strong>, the wallet is kept in the app&apos;s memory only, and it locks after 15 minutes
            without use.
          </li>
          <li>Your theme choice, in the app&apos;s settings.</li>
        </ul>
        <p>Your seed phrase and private keys never leave your device. We cannot see them or recover them.</p>
      </Section>

      <Section title="What is sent, and to whom">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Hiro (api.hiro.so)</strong>, a public Stacks API: your address, to prepare transactions you approve,
            show your activity and NFTs, and for the Status tab&apos;s checks; the transactions you approve, to broadcast
            them; and the network&apos;s status.
          </li>
          <li>
            <strong>Charisma&apos;s balance service (swap.charisma.rocks)</strong>: your public address, to show your
            balances, including changes still on their way and amounts your signed orders set aside, and to update
            them live while the wallet is open. It reads public blockchain data, keeps your address only in short-lived
            caches that expire within an hour, and doesn&apos;t tie it to an account. Like any web request, it can appear
            briefly in our hosting provider&apos;s request logs.
          </li>
          <li>
            <strong>Charisma&apos;s swap service (swap.charisma.rocks)</strong>: the two tokens and the amount of a trade,
            to find its route and quote. Quotes don&apos;t include your address.
          </li>
          <li>
            <strong>Charisma&apos;s order service (swap.charisma.rocks)</strong>, only when you place a Blaze order: your
            address, the tokens, the amount and your signature over the order, so a solver can fill it. The order is
            kept so it can be filled and shown in its history.
          </li>
          <li>
            <strong>Charisma&apos;s token list, prices and vault list (tokens.charisma.rocks, prices.charisma.rocks,
            invest.charisma.rocks)</strong>: requests for token names, logos, decimals, prices and the pools a route may
            use. These requests do not include your address.
          </li>
          <li>
            <strong>Where token logos and NFT pictures are hosted</strong>: to show a logo or picture, the wallet loads it
            from the address the token&apos;s or NFT&apos;s maker gave, which can be the maker&apos;s own server or a
            public IPFS gateway (ipfs.io). Those servers see a request from your device, not your wallet address. The
            iPhone app only loads logos of tokens on Charisma&apos;s list.
          </li>
          <li>
            <strong>Websites you connect to</strong> (extension): only what you approve on screen, such as your address,
            a signed message, or a transaction. A site never receives your keys.
          </li>
          <li>
            <strong>The Hiro explorer (explorer.hiro.so)</strong>, when you open a transaction or a contract from the
            wallet.
          </li>
        </ul>
        <p>
          Anything broadcast to the Stacks blockchain, like your address and transactions, is public by nature and
          permanent.
        </p>
      </Section>

      <Section title="Permissions">
        <p><strong>The browser extension</strong> asks for:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Storage</strong>: to keep your encrypted vault on your device.</li>
          <li><strong>Side panel</strong>: the wallet opens in Chrome&apos;s side panel.</li>
          <li>
            <strong>Access to websites and scripting</strong>: so any Stacks app can find the wallet and ask it to
            connect or sign, the standard way Stacks wallets work. The extension reads nothing from the pages you visit.
          </li>
        </ul>
        <p>
          <strong>The iPhone app</strong> asks for <strong>Face ID</strong>, to unlock the wallet. It doesn&apos;t use your
          contacts, photos, location, camera or microphone.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can lock the wallet at any time. In the extension, <strong>Unlink</strong> removes it from the browser
          entirely, and uninstalling the extension deletes everything it stored. In the iPhone app,{' '}
          <strong>Unlink</strong> removes a seed phrase from that iPhone, and deleting the app removes the wallet: it
          isn&apos;t there when the app is installed again. Your funds stay on the blockchain either way, and your seed
          phrase restores them in any Stacks wallet.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy: <a className="underline" href="https://github.com/r0zar/charisma/issues">open an issue on GitHub</a>.
        </p>
      </Section>
    </main>
  );
}
