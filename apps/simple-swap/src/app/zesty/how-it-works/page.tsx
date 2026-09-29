import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/zesty/Footer';

export const metadata: Metadata = {
  title: 'How Zesty works | Technical overview',
  description: 'Custody, signed orders, execution, payout guarantees and risks of Zesty trades on Stacks.',
};

const EXPLORER = 'https://explorer.hiro.so/txid';
const D = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS';

const SECTIONS = [
  ['overview', 'Overview'],
  ['custody', 'Custody'],
  ['orders', 'Signed orders'],
  ['execution', 'Execution'],
  ['payout', 'Payout guarantee'],
  ['pricing', 'Prices and triggers'],
  ['risks', 'Risks and trust'],
  ['faq', 'FAQ'],
  ['contracts', 'Contracts'],
];

const CONTRACTS = [
  ['blaze-v1', `${D}.blaze-v1`, 'Verifies SIP-018 signatures and marks each order id as used'],
  ['sbtc-token-subnet-v1', `${D}.sbtc-token-subnet-v1`, 'Holds deposited sBTC 1:1; ledger of balances'],
  ['zest-token-subnet', `${D}.zest-token-subnet`, 'Holds deposited ZEST 1:1; ledger of balances'],
  ['x-multihop-v1', `${D}.x-multihop-v1`, 'Executes the swap route; pays out only to the signer'],
  ['feeling-zesty', `${D}.feeling-zesty`, "Adapter for Bitflow's ZEST-STX pool"],
  ['nakamoto-flow', `${D}.nakamoto-flow`, "Adapter for Bitflow's sBTC-STX pool"],
];

const FAQ: [string, string][] = [
  ['Is my money safe in Zesty?', 'Deposits are held 1:1 by a contract with no owner functions. Only your wallet can withdraw your balance.'],
  ['What am I approving?', 'One swap of an exact amount of one token, usable once. It cannot move anything else.'],
  ['Can someone else use my approval?', 'They can submit it, but the router only pays the wallet that signed it, so the result still comes to you.'],
  ['How do I stop a trade?', 'Cancel it in My trades. For a guaranteed stop, move your money out of Zesty; an approval cannot spend a balance that is no longer there.'],
  ['Do I pay gas?', 'Adding or withdrawing money is a normal wallet transaction with a small network fee. Trades that run on your behalf are paid for by the solver.'],
  ['Why approve more than once?', 'Each trade that runs later needs its own approval: converting now, the target, and the safety net are separate trades.'],
];

function H2({ id, n, children }: { id: string; n: number; children: React.ReactNode }) {
  return (
    <h2 id={id} className="m-0 scroll-mt-24 border-t border-[#E5E5E5] pt-10 text-[26px] font-medium text-black">
      <span className="mr-3 text-[#B8410F]">{n}.</span>{children}
    </h2>
  );
}

const P = ({ children }: { children: React.ReactNode }) => <p className="m-0 text-[16px] leading-[1.75] text-[#2B2B2B]">{children}</p>;
const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-[#F0F0F0] px-1.5 py-0.5 font-mono text-[14px] text-black">{children}</code>;

function Figure({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="m-0 flex flex-col gap-3 rounded-2xl border border-[#E5E5E5] bg-white p-5">
      {children}
      <figcaption className="text-[13px] text-[#5C5C5C]">{caption}</figcaption>
    </figure>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#E5E5E5] bg-white">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr className="bg-[#F7F7F7]">{head.map(h => <th key={h} className="border-b border-[#E5E5E5] px-4 py-3 font-medium text-black">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i > 0 ? 'border-t border-[#E5E5E5]' : ''}>
              {row.map((cell, j) => <td key={j} className="px-4 py-3 align-top text-[#2B2B2B]">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Wallet → Zesty → execution. */
function OverviewDiagram() {
  const box = (x: number, title: string, sub: string, accent?: boolean) => (
    <g>
      <rect x={x} y="10" width="180" height="84" rx="12" fill={accent ? '#FFF4EF' : '#FFFFFF'} stroke={accent ? '#FC6432' : '#1A1A1A'} strokeWidth="1.5" />
      <text x={x + 90} y="46" textAnchor="middle" fontSize="16" fontWeight="500" fill="#1A1A1A">{title}</text>
      <text x={x + 90} y="70" textAnchor="middle" fontSize="13" fill="#5C5C5C">{sub}</text>
    </g>
  );
  const arrow = (x: number, label: string) => (
    <g>
      <line x1={x} y1="52" x2={x + 30} y2="52" stroke="#1A1A1A" strokeWidth="1.5" />
      <path d={`M${x + 30} 47 l8 5 l-8 5 z`} fill="#1A1A1A" />
      <text x={x + 19} y="118" textAnchor="middle" fontSize="12" fill="#5C5C5C">{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 640 130" className="h-auto w-full" role="img" aria-label="Wallet deposits into Zesty; a signed order is executed when the price condition is met">
      {box(0, 'Wallet', 'sBTC or ZEST')}
      {arrow(186, 'deposit')}
      {box(230, 'Zesty (subnet)', 'held 1:1')}
      {arrow(416, 'signed order')}
      {box(460, 'Execution', 'when price hits', true)}
    </svg>
  );
}

/** Subnet token contract: reserve plus ledger. */
function CustodyDiagram() {
  return (
    <svg viewBox="0 0 640 200" className="h-auto w-full" role="img" aria-label="The subnet contract holds the deposited tokens and a ledger of balances">
      <rect x="160" y="10" width="320" height="180" rx="14" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="1.5" />
      <text x="320" y="38" textAnchor="middle" fontSize="14" fill="#5C5C5C">subnet token contract</text>
      <rect x="182" y="56" width="130" height="112" rx="10" fill="#FFF4EF" stroke="#FC6432" strokeWidth="1.5" />
      <text x="247" y="106" textAnchor="middle" fontSize="15" fontWeight="500" fill="#1A1A1A">reserve</text>
      <text x="247" y="128" textAnchor="middle" fontSize="12" fill="#5C5C5C">deposited sBTC</text>
      <rect x="328" y="56" width="130" height="112" rx="10" fill="#F7F7F7" stroke="#D0D0D0" strokeWidth="1.5" />
      <text x="393" y="82" textAnchor="middle" fontSize="14" fontWeight="500" fill="#1A1A1A">ledger</text>
      <text x="393" y="106" textAnchor="middle" fontSize="12" fill="#3D3D3D">you   0.0025</text>
      <text x="393" y="126" textAnchor="middle" fontSize="12" fill="#3D3D3D">alice 0.1000</text>
      <text x="393" y="146" textAnchor="middle" fontSize="12" fill="#3D3D3D">bob   0.0400</text>
      <line x1="20" y1="80" x2="150" y2="80" stroke="#1A1A1A" strokeWidth="1.5" />
      <path d="M150 75 l8 5 l-8 5 z" fill="#1A1A1A" />
      <text x="84" y="70" textAnchor="middle" fontSize="12" fill="#3D3D3D">deposit</text>
      <line x1="158" y1="136" x2="28" y2="136" stroke="#1A1A1A" strokeWidth="1.5" />
      <path d="M28 131 l-8 5 l8 5 z" fill="#1A1A1A" />
      <text x="92" y="158" textAnchor="middle" fontSize="12" fill="#3D3D3D">withdraw (owner only)</text>
    </svg>
  );
}

/** Execution sequence. */
function ExecutionDiagram() {
  const steps = [
    ['Executor', 'Price condition met; builds x-swap with route and post-conditions'],
    ['blaze-v1', 'Recovers signer, rejects a used order id'],
    ['Subnet token', 'Moves exactly the signed amount to x-multihop-v1'],
    ['x-multihop-v1', 'Checks payout address = signer, then runs the route'],
    ['Pools', 'Swap through Bitflow pools via Charisma adapters'],
    ['Subnet token', 'Output credited to the signer in Zesty'],
  ];
  return (
    <svg viewBox="0 0 640 380" className="h-auto w-full" role="img" aria-label="Six execution steps from the executor to the payout">
      <line x1="30" y1="30" x2="30" y2="350" stroke="#D0D0D0" strokeWidth="2" />
      {steps.map(([actor, text], i) => (
        <g key={i} transform={`translate(0 ${16 + i * 62})`}>
          <circle cx="30" cy="16" r="15" fill="#FFFFFF" stroke={i === 3 ? '#FC6432' : '#1A1A1A'} strokeWidth="1.5" />
          <text x="30" y="21" textAnchor="middle" fontSize="13" fontWeight="500" fill="#1A1A1A">{i + 1}</text>
          <text x="60" y="13" fontSize="14" fontWeight="500" fill="#1A1A1A">{actor}</text>
          <text x="60" y="33" fontSize="13" fill="#3D3D3D">{text}</text>
        </g>
      ))}
    </svg>
  );
}

export default function HowItWorksPage() {
  const number = (id: string) => SECTIONS.findIndex(([sid]) => sid === id) + 1;
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F7F7]">
      <header className="bg-black text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/zesty" className="flex items-center gap-2.5">
            <span className="h-7 w-7 rounded-full bg-[#FC6432]" />
            <span className="text-[18px] font-medium tracking-[0.12em]">ZESTY</span>
          </Link>
          <Link href="/zesty" className="flex min-h-[44px] items-center rounded-full bg-[#FC6432] px-4 text-[14px] font-medium text-black">Open Zesty</Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-6 py-12 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Contents" className="hidden lg:block">
          <div className="sticky top-8 flex flex-col gap-1 text-[14px]">
            <span className="mb-2 text-[12px] tracking-[0.14em] text-[#5C5C5C] uppercase">Contents</span>
            {SECTIONS.map(([id, title], i) => (
              <a key={id} href={`#${id}`} className="rounded-lg px-2 py-1.5 text-[#3D3D3D] hover:bg-white hover:text-black">{i + 1}. {title}</a>
            ))}
          </div>
        </nav>

        <article className="flex max-w-[720px] flex-col gap-6">
          <header className="flex flex-col gap-3">
            <span className="text-[13px] tracking-[0.14em] text-[#5C5C5C] uppercase">Technical overview</span>
            <h1 className="m-0 text-[40px] leading-tight font-medium">How Zesty works</h1>
            <P>Zesty places conditional trades between ZEST and sBTC on Stacks. You deposit funds into subnet token contracts, sign an order, and a solver executes it when the price condition is met. This page describes how funds are held, what a signature authorizes, how orders execute, and what you are trusting.</P>
          </header>

          <H2 id="overview" n={number('overview')}>Overview</H2>
          <Figure caption="Figure 1. Funds move into Zesty once; each later trade is a signed order executed on your behalf.">
            <OverviewDiagram />
          </Figure>
          <Table head={['Component', 'Role']} rows={[
            ['Subnet tokens', 'Hold deposited sBTC and ZEST 1:1 and track balances'],
            [<Code key="b">blaze-v1</Code>, 'Verifies order signatures and enforces single use'],
            ['Executor (solver)', 'Watches prices and submits orders when their condition is met; pays network fees'],
            [<Code key="r">x-multihop-v1</Code>, 'Runs the swap route and pays the result to the signer'],
            ['Pools', "Bitflow's ZEST-STX and sBTC-STX pools, via Charisma adapters"],
          ]} />

          <H2 id="custody" n={number('custody')}>Custody</H2>
          <P>A subnet token is a contract that holds a real token in reserve and keeps a ledger of who owns it. Depositing transfers your tokens to the contract and credits your ledger balance. Withdrawing debits your balance and returns the same amount of the underlying token. Only the owner of a balance can withdraw it.</P>
          <Figure caption="Figure 2. The subnet token contract holds deposits 1:1 and records balances.">
            <CustodyDiagram />
          </Figure>
          <P>The contracts have no administrative functions: there is no way to freeze balances, mint unbacked tokens, or withdraw on someone else&apos;s behalf. Transfers inside the ledger happen either from your own wallet or through a signed order, which is what allows trades to run without your wallet present.</P>

          <H2 id="orders" n={number('orders')}>Signed orders</H2>
          <P>Each trade that runs later is authorized by a SIP-018 structured-data signature from your wallet. It moves nothing by itself. The signed message has six fields:</P>
          <Table head={['Field', 'Value', 'Effect']} rows={[
            [<Code key="1">contract</Code>, 'the subnet token', 'Only this token can be moved'],
            [<Code key="2">intent</Code>, <Code key="2v">TRANSFER_TOKENS</Code>, 'A transfer to a named target'],
            [<Code key="3">opcode</Code>, 'none', 'Unused'],
            [<Code key="4">amount</Code>, 'exact amount', 'Only this amount can be moved'],
            [<Code key="5">target</Code>, <Code key="5v">x-multihop-v1</Code>, 'Only the router can receive it'],
            [<Code key="6">uuid</Code>, 'unique id', 'Recorded on first use; cannot be replayed'],
          ]} />
          <P>The signing domain is <Code>BLAZE_PROTOCOL</Code> version <Code>v1.0</Code> on Stacks mainnet. The price condition and the swap route are not part of the signature; the executor chooses them at execution time.</P>

          <H2 id="execution" n={number('execution')}>Execution</H2>
          <P>The executor checks open orders every minute. When an order&apos;s condition is met, it finds the best route through registered pools and submits an <Code>x-swap</Code> transaction. The transaction carries post-conditions in deny mode: the router may send at most the signed amount, each pool must return at least its quoted output, and any other token movement aborts the transaction.</P>
          <Figure caption="Figure 3. Execution of a signed order.">
            <ExecutionDiagram />
          </Figure>
          <P>The executor pays the network fee for each execution from the solver account. If the solver runs out of STX, orders stop executing until it is refilled; your funds stay in Zesty.</P>

          <H2 id="payout" n={number('payout')}>Payout guarantee</H2>
          <P>Before running a route, <Code>x-multihop-v1</Code> recovers the signer from the order signature using <Code>blaze-v1</Code> and requires the payout address to equal that signer. If they differ, the transaction fails and nothing moves. Anyone can submit a signed order, but the output can only go to the wallet that signed it.</P>
          <P>A target and its safety net spend the same funds. When one executes, the other is cancelled so it cannot run later.</P>

          <H2 id="pricing" n={number('pricing')}>Prices and triggers</H2>
          <Table head={['Parameter', 'Value']} rows={[
            ['Price source', "Charisma's price feed (USD), derived from on-chain swap quotes"],
            ['Trigger price', 'ZEST priced in sBTC (sats per ZEST), not dollars, so a move that lifts both coins does not trigger'],
            ['Price refresh', 'About once an hour'],
            ['Condition checks', 'Every minute, against the latest price'],
            ['Slippage allowance', 'About 1% per swap'],
            ['Pool fees', 'Set by each pool; about 1% for ZEST-STX'],
          ]} />
          <P>Because prices refresh hourly, a short spike may not trigger an order, and an order can execute somewhat past its target. If the market moves quickly past a safety net, the order executes at the next available price.</P>

          <H2 id="risks" n={number('risks')}>Risks and trust</H2>
          <Table head={['Area', 'What you rely on']} rows={[
            ['Timing', 'The executor submitting your order when the condition is met. It cannot change where the output goes.'],
            ['Liveness', 'The executor running and the solver holding enough STX for fees.'],
            ['Prices', 'The price feed being accurate and reasonably current.'],
            ['Smart contracts', 'The subnet tokens, blaze-v1, the router, the adapters and the Bitflow pools behaving as written.'],
            ['Liquidity', 'Enough depth in the pools; large trades cost more and may not be quotable.'],
          ]} />
          <P>Cancelling an order tells the executor not to submit it, but the signature remains valid on-chain until used. To make an order impossible to execute, withdraw your funds from Zesty.</P>

          <H2 id="faq" n={number('faq')}>FAQ</H2>
          <div className="flex flex-col gap-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-xl border border-[#E5E5E5] bg-white px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium text-black">
                  {q}
                  <span className="text-[20px] leading-none text-[#B8410F] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="m-0 mt-3 text-[15px] leading-relaxed text-[#2B2B2B]">{a}</p>
              </details>
            ))}
          </div>

          <H2 id="contracts" n={number('contracts')}>Contracts</H2>
          <Table head={['Contract', 'Purpose']} rows={CONTRACTS.map(([name, id, role]) => [
            <a key={id} href={`${EXPLORER}/${id}?chain=mainnet`} target="_blank" rel="noopener noreferrer" className="font-mono text-[13px] text-[#B8410F] underline underline-offset-2">{name}</a>,
            role,
          ])} />
          <P>All contracts are deployed on Stacks mainnet by <Code>{D.slice(0, 6)}…{D.slice(-4)}</Code>. Source is readable on the explorer.</P>
        </article>
      </div>
      <Footer />
    </div>
  );
}
