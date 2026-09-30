import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blaze Wallet privacy policy',
  description: 'What the Blaze Wallet browser extension stores, what it sends, and to whom.',
};

const UPDATED = 'September 29, 2026';

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
          Blaze Wallet is a browser extension wallet for the Stacks blockchain, made by Charisma. It has no accounts,
          no analytics and no tracking, and we never sell data. This page lists everything it stores and every place it
          sends information.
        </p>
      </header>

      <Section title="What stays on your device">
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
        <p>Your seed phrase and private keys never leave your device. We cannot see them or recover them.</p>
      </Section>

      <Section title="What is sent, and to whom">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Hiro (api.hiro.so)</strong>, a public Stacks API: your address, to read balances and the
            network&apos;s status; subnet balance reads for your address; and transactions you approve, to broadcast them.
          </li>
          <li>
            <strong>Charisma (tokens.charisma.rocks, lakehouse.charisma.rocks)</strong>: requests for token names, logos,
            decimals and prices. These requests do not include your address.
          </li>
          <li>
            <strong>Websites you connect to</strong>: only what you approve on screen, such as your address, a signed
            message, or a transaction. A site never receives your keys.
          </li>
        </ul>
        <p>
          Anything broadcast to the Stacks blockchain, like your address and transactions, is public by nature and
          permanent.
        </p>
      </Section>

      <Section title="Permissions the extension asks for">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Storage</strong>: to keep your encrypted vault on your device.</li>
          <li><strong>Side panel</strong>: the wallet opens in Chrome&apos;s side panel.</li>
          <li>
            <strong>Access to websites and scripting</strong>: so any Stacks app can find the wallet and ask it to
            connect or sign, the standard way Stacks wallets work. The extension reads nothing from the pages you visit.
          </li>
        </ul>
      </Section>

      <Section title="Your choices">
        <p>
          You can lock the wallet at any time, and <strong>Unlink</strong> removes it from the browser entirely.
          Uninstalling the extension deletes everything it stored. Your funds stay on the blockchain either way, and
          your seed phrase restores them in any Stacks wallet.
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
