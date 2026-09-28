import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How Zesty works | Subnets, signed trades and what you trust',
  description: 'How Zesty holds your money, finishes trades while you are away, and the risks you should know about.',
};

const EXPLORER = 'https://explorer.hiro.so/txid';
const CONTRACTS = [
  ['blaze-v1', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-v1', 'Checks your signature and makes sure it is used once'],
  ['sBTC in Zesty', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1', 'Holds deposited sBTC 1:1 and keeps the ledger'],
  ['ZEST in Zesty', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.zest-token-subnet', 'Holds deposited ZEST 1:1 and keeps the ledger'],
  ['Swap router', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9', 'Runs the swap your signature pays into'],
  ['Feeling Zesty', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.feeling-zesty', "Connects to Bitflow's ZEST-STX pool"],
  ['Nakamoto Flow', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.nakamoto-flow', "Connects to Bitflow's sBTC-STX pool"],
];

function Section({ eyebrow, title, dark, children }: { eyebrow: string; title: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <section className={`px-6 py-14 ${dark ? 'bg-black text-white' : 'bg-[#F7F7F7] text-black'}`}>
      <div className="mx-auto flex max-w-[640px] flex-col gap-5">
        <span className={`text-[13px] tracking-[0.14em] uppercase ${dark ? 'text-[#D9D9D9]' : 'text-[#5C5C5C]'}`}>{eyebrow}</span>
        <h2 className="m-0 text-[30px] leading-[1.1] font-medium uppercase">{title}</h2>
        {children}
      </div>
    </section>
  );
}

const P = ({ children, dark }: { children: React.ReactNode; dark?: boolean }) => (
  <p className={`m-0 text-[16px] leading-relaxed ${dark ? 'text-[#D9D9D9]' : 'text-[#3D3D3D]'}`}>{children}</p>
);

/** Wallet → Zesty → trade, the three-box overview. */
function OverviewDiagram() {
  const box = (x: number, label: string, sub: string, fill: string, text: string) => (
    <g>
      <rect x={x} y="20" width="170" height="90" rx="16" fill={fill} />
      <text x={x + 85} y="60" textAnchor="middle" fontSize="18" fontWeight="500" fill={text}>{label}</text>
      <text x={x + 85} y="84" textAnchor="middle" fontSize="13" fill={text} opacity="0.75">{sub}</text>
    </g>
  );
  const arrow = (x: number, label: string) => (
    <g>
      <line x1={x} y1="65" x2={x + 38} y2="65" stroke="#FC6432" strokeWidth="3" />
      <path d={`M${x + 38} 58 l10 7 l-10 7 z`} fill="#FC6432" />
      <text x={x + 24} y="130" textAnchor="middle" fontSize="12" fill="#5C5C5C">{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 640 145" className="h-auto w-full" role="img" aria-label="Your wallet sends money into Zesty; a signed trade runs later when the price hits">
      {box(0, 'Your wallet', 'sBTC or ZEST', '#FFFFFF', '#000000')}
      {arrow(180, 'add money')}
      {box(235, 'Zesty', 'same coins, 1:1', '#000000', '#FFFFFF')}
      {arrow(415, 'signed trade')}
      {box(470, 'Price hits', 'trade runs for you', '#FC6432', '#000000')}
    </svg>
  );
}

/** Deposits lock real coins in the contract; the ledger records whose they are. */
function VaultDiagram() {
  return (
    <svg viewBox="0 0 640 230" className="h-auto w-full" role="img" aria-label="The Zesty contract holds the real coins and a ledger of balances; deposit and withdraw move coins in and out 1:1">
      <rect x="170" y="20" width="300" height="190" rx="20" fill="#141414" stroke="#FC6432" strokeWidth="2" />
      <text x="320" y="52" textAnchor="middle" fontSize="15" fill="#D9D9D9">Zesty contract (subnet token)</text>
      <rect x="195" y="70" width="120" height="110" rx="12" fill="#FC6432" />
      <text x="255" y="118" textAnchor="middle" fontSize="15" fontWeight="500" fill="#000">real sBTC</text>
      <text x="255" y="140" textAnchor="middle" fontSize="12" fill="#000">locked 1:1</text>
      <rect x="330" y="70" width="120" height="110" rx="12" fill="#FFFFFF" />
      <text x="390" y="98" textAnchor="middle" fontSize="13" fontWeight="500" fill="#000">Ledger</text>
      <text x="390" y="122" textAnchor="middle" fontSize="12" fill="#3D3D3D">you: 0.0025</text>
      <text x="390" y="142" textAnchor="middle" fontSize="12" fill="#3D3D3D">alice: 0.1000</text>
      <text x="390" y="162" textAnchor="middle" fontSize="12" fill="#3D3D3D">bob: 0.0400</text>
      <line x1="20" y1="90" x2="160" y2="90" stroke="#000" strokeWidth="2.5" />
      <path d="M160 83 l10 7 l-10 7 z" fill="#000" />
      <text x="90" y="78" textAnchor="middle" fontSize="13" fill="#000">deposit</text>
      <line x1="170" y1="150" x2="30" y2="150" stroke="#000" strokeWidth="2.5" />
      <path d="M30 143 l-10 7 l10 7 z" fill="#000" />
      <text x="95" y="175" textAnchor="middle" fontSize="13" fill="#000">withdraw (only you)</text>
      <text x="545" y="110" textAnchor="middle" fontSize="13" fill="#3D3D3D">no admin keys</text>
      <text x="545" y="130" textAnchor="middle" fontSize="13" fill="#3D3D3D">no freeze</text>
    </svg>
  );
}

/** Four steps of a trade, big and simple. */
function StepsDiagram() {
  const steps = [
    ['1', 'You approve', 'Your wallet signs one trade'],
    ['2', 'We watch', 'Every minute, we check the price'],
    ['3', 'Price hits', 'We run your trade'],
    ['4', 'Money back', 'The result lands in Zesty, yours'],
  ];
  return (
    <svg viewBox="0 0 640 360" className="h-auto w-full" role="img" aria-label="You approve, we watch the price, the price hits and we run the trade, the money comes back to you">
      <line x1="40" y1="40" x2="40" y2="320" stroke="#FC6432" strokeWidth="3" strokeDasharray="6 6" />
      {steps.map(([n, title, body], i) => (
        <g key={n} transform={`translate(0 ${20 + i * 90})`}>
          <circle cx="40" cy="22" r="22" fill={i === 2 ? '#FC6432' : '#FFFFFF'} stroke="#FC6432" strokeWidth="3" />
          <text x="40" y="29" textAnchor="middle" fontSize="18" fontWeight="500" fill="#000">{n}</text>
          <text x="84" y="20" fontSize="20" fontWeight="500" fill="#FFFFFF">{title}</text>
          <text x="84" y="46" fontSize="15" fill="#D9D9D9">{body}</text>
        </g>
      ))}
    </svg>
  );
}

const FAQ: [string, React.ReactNode][] = [
  ['Is my money safe in Zesty?', 'Your coins sit in a Stacks contract, 1 for 1. Nobody can freeze them or take them out for you. Only your wallet can move them back.'],
  ['What am I approving?', 'One trade: swap exactly this much of one coin, one time. That approval can\'t touch anything else in your wallet, and it can\'t be used twice.'],
  ['What could go wrong?', (
    <ul className="m-0 flex flex-col gap-2 pl-5">
      <li><strong className="font-medium text-black">You trust our server to run it right.</strong> It keeps your approval, runs the trade when your price hits, and sends the result back to you. The approval itself doesn&apos;t say who gets the result, so our server is what makes sure it&apos;s you.</li>
      <li><strong className="font-medium text-black">Prices update about once an hour.</strong> A quick spike might not trigger your trade.</li>
      <li><strong className="font-medium text-black">Fast moves can jump past your price.</strong> Your trade then runs at the next price available.</li>
      <li><strong className="font-medium text-black">Each swap costs about 1%.</strong> More on very big trades.</li>
      <li><strong className="font-medium text-black">Code can have bugs.</strong> The contracts are tested, but nothing is risk-free.</li>
    </ul>
  )],
  ['Can someone steal my approval?', 'We never show approvals to anyone. Even so, one only works once, for that exact amount, through the swap router.'],
  ['How do I stop a trade?', 'Tap Cancel in My trades. Want a guaranteed stop? Move your money out of Zesty. With nothing to spend, an approval can\'t do anything.'],
  ['Do I pay gas?', 'Adding or moving money is a normal wallet transaction with a tiny network fee. The trades themselves are on us.'],
  ['Why approve more than once?', 'Each trade that runs while you\'re away needs its own approval: buy now, sell later and the safety net are separate trades.'],
];

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col">
      <header className="flex items-center justify-between bg-black px-6 py-4 text-white">
        <Link href="/zesty" className="flex items-center gap-2.5">
          <span className="h-7 w-7 rounded-full bg-[#FC6432]" />
          <span className="text-[18px] font-medium tracking-[0.12em]">ZESTY</span>
        </Link>
        <Link href="/zesty" className="flex min-h-[44px] items-center rounded-full bg-[#FC6432] px-4 text-[14px] font-medium text-black">Start a trade</Link>
      </header>

      <Section eyebrow="How it works" title="Set it. Walk away.">
        <P>Pick up or down. Pick a price. Approve. When ZEST hits your price, Zesty makes the trade for you, even while you sleep.</P>
        <OverviewDiagram />
      </Section>

      <Section eyebrow="Where's my money?" title="Real coins, 1 for 1" dark>
        <P dark>Money in Zesty is your real sBTC or ZEST, held in a contract. Only you can take it out.</P>
        <VaultDiagram />
      </Section>

      <Section eyebrow="While you're away" title="How your trade runs" dark>
        <StepsDiagram />
      </Section>

      <Section eyebrow="Questions" title="FAQ">
        <div className="flex flex-col gap-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-[#E5E5E5] bg-white p-5">
              <summary className="flex min-h-[28px] cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-medium">
                {q}
                <span className="text-[22px] leading-none text-[#FC6432] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <div className="mt-3 text-[15px] leading-relaxed text-[#3D3D3D]">{a}</div>
            </details>
          ))}
        </div>
      </Section>

      <Section eyebrow="For the nerds" title="Under the hood" dark>
        <details className="rounded-2xl bg-[#141414] p-5">
          <summary className="cursor-pointer text-[16px] font-medium">What exactly gets signed</summary>
          <div className="mt-4 flex flex-col gap-4">
            <P dark>Trades are SIP-018 structured messages, checked on-chain by <code>blaze-v1</code>. It recovers the signer and marks the id as used, so each approval works once.</P>
            <pre className="m-0 overflow-x-auto rounded-xl bg-black p-4 text-[13px] leading-relaxed text-[#D9D9D9]">{`domain "BLAZE_PROTOCOL" v1.0
{
  contract: zest-token-subnet  ← only this coin
  intent:   "TRANSFER_TOKENS"
  amount:   1223000000         ← exactly this much
  target:   x-multihop-rc9     ← only into the swap router
  uuid:     "7f3a…"            ← once, ever
}`}</pre>
            <P dark>The router then runs the swap route and pays out to the recipient given by whoever submits the approval. Zesty&apos;s executor always submits your trades with you as the recipient, and approvals are never shared outside it.</P>
          </div>
        </details>
        <details className="rounded-2xl bg-[#141414] p-5">
          <summary className="cursor-pointer text-[16px] font-medium">The contracts</summary>
          <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
            {CONTRACTS.map(([name, id, role]) => (
              <li key={id} className="flex flex-col gap-1">
                <span className="text-[15px] font-medium">{name} · <span className="font-normal text-[#D9D9D9]">{role}</span></span>
                <a href={`${EXPLORER}/${id}?chain=mainnet`} target="_blank" rel="noopener noreferrer" className="text-[13px] break-all text-[#FC6432] underline">{id}</a>
              </li>
            ))}
          </ul>
        </details>
        <Link href="/zesty" className="mt-2 flex min-h-[56px] items-center justify-center rounded-[14px] bg-[#FC6432] text-[16px] font-medium tracking-[0.08em] text-black uppercase">Start a trade</Link>
      </Section>
    </div>
  );
}
