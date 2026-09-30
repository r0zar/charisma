import Link from 'next/link';

const CYAN = 'rgb(125, 249, 255)';

const FEATURES: { title: string; body: string }[] = [
  { title: 'Works with any Stacks app', body: 'Speaks the standard Stacks wallet language, so it shows up in every app’s “Connect wallet” list.' },
  { title: 'Blaze subnets built in', body: 'Signs Blaze orders for Charisma subnets, and shows each one in plain words before you sign.' },
  { title: 'Approvals nobody can fake', body: 'Every request opens a sealed card the website can’t read or click, and it waits until nothing covers it.' },
  { title: 'Your keys stay with you', body: 'Encrypted in your browser, never sent anywhere. Locks itself after 15 minutes idle.' },
  { title: 'Every token, one view', body: 'Balances with logos and dollar values, and sends that allow exactly the amount you choose.' },
  { title: 'Built for tiny payments', body: 'Coming next: let a site you trust sign small Blaze orders on its own, within limits you set.' },
];

/** A HUD-style panel: thin teal frame, uppercase monospace title bar */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[2px] p-1" style={{ border: '1px solid rgba(125, 249, 255, 0.6)', background: 'rgba(8, 12, 18, 0.85)', boxShadow: '0 0 20px rgba(0,0,0,0.8), inset 0 0 8px rgba(125,249,255,0.15)' }}>
      <div className="flex items-center justify-between px-1 py-0.5 font-mono text-[10px] font-bold tracking-wide" style={{ color: CYAN, borderBottom: '1px solid rgba(125, 249, 255, 0.6)' }}>
        <span>{title}</span>
        <span>●</span>
      </div>
      <div className="px-1 pt-2 pb-1 text-[14px] leading-relaxed text-white/80">{children}</div>
    </div>
  );
}

export default function BlazeWalletLanding() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-14 px-5 py-16">
      <section className="flex flex-col items-center gap-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/wallet/icon.png" alt="" width={96} height={96} style={{ filter: 'drop-shadow(0 0 18px rgba(125, 249, 255, 0.45))' }} />
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[12px] tracking-[0.2em]" style={{ color: CYAN }}>CHROME EXTENSION · STACKS</span>
          <h1 className="text-4xl font-semibold sm:text-5xl" style={{ textShadow: '0 0 24px rgba(125, 249, 255, 0.35)' }}>Blaze Wallet</h1>
          <p className="mx-auto max-w-xl text-lg text-white/75">
            The wallet for Stacks and Blaze subnets. Connect to any app, sign and send, and see exactly what you’re approving.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <span
            className="rounded-[2px] px-5 py-3 font-mono text-[12px] font-bold tracking-wider"
            style={{ border: `1px solid ${CYAN}`, color: CYAN, background: 'rgba(125, 249, 255, 0.08)', boxShadow: '0 0 12px rgba(125, 249, 255, 0.25)' }}
          >
            COMING SOON TO THE CHROME WEB STORE
          </span>
          <Link href="/wallet/privacy" className="rounded-[2px] px-5 py-3 font-mono text-[12px] font-bold tracking-wider text-white/70 hover:text-white" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
            PRIVACY
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(feature => (
          <Panel key={feature.title} title={feature.title.toUpperCase()}>{feature.body}</Panel>
        ))}
      </section>

      <footer className="flex flex-col items-center gap-2 pb-6 font-mono text-[11px] text-white/45">
        <span>BLAZE WALLET · BY CHARISMA</span>
        <span>
          <Link href="/wallet/privacy" className="underline hover:text-white/80">Privacy policy</Link>
          {' · '}
          <a href="https://github.com/r0zar/charisma/issues" className="underline hover:text-white/80">Support</a>
        </span>
      </footer>
    </main>
  );
}
