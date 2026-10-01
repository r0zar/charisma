import type { Metadata } from 'next';
import { PageIntro, SectionTitle } from '@/components/page-intro';

export const metadata: Metadata = { title: 'Voice' };

const QUOTES = [
  'Open-source pools and routing that belong to no one and work for everyone.',
  'Swap from your wallet, or off chain in an instant.',
  'We sell your ZEST for you when it rises.',
];
const DO_DONT: [string, string][] = [
  ['Connect wallet', 'Connect Wallet'],
  ['The price moved more than 1.0%. Nothing left your wallet. Try again for a fresh quote.', 'Error: slippage exceeded!'],
  ['222 sats ≈ $0.1882', '$0.1882 (222 sats)'],
  ['SP2ZN…55KS', 'SP2ZNGJ15...7BM55KS'],
  ['Tools for Bitcoin builders and users', 'The next generation of decentralized finance'],
];
const NUMBERS = [
  ['Amounts', 'Symbol after the figure, in mono: 1,000 STX.'],
  ['Prices', 'Both units, mono first, then the muted USD hint: 222 sats ≈ $0.1882.'],
  ['Large figures', 'K and M from $10,000: $6.8M, 22,711 trades.'],
  ['Addresses', 'First 5 and last 4 characters: SP2ZN…55KS.'],
  ['Tickers', 'Exact casing, always: STX, sBTC, CHA, USDCx.'],
];

export default function VoicePage() {
  return (
    <>
      <PageIntro eyebrow="Voice" title="Plain words, real numbers">
        Charisma talks like a knowledgeable friend on the user’s side: short sentences, “you” for the user, “we” for Charisma doing work on their behalf.
      </PageIntro>
      <div className="grid gap-4 md:grid-cols-3">
        {QUOTES.map(q => <blockquote key={q} className="cx-card text-[19px] leading-[28px] font-semibold">“{q}”</blockquote>)}
      </div>

      <SectionTitle note="Sentence case everywhere; uppercase belongs only to mono labels.">Write this, not that</SectionTitle>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[560px] border-collapse text-[15px] leading-[22px]">
          <thead><tr className="text-left"><th className="cx-label px-5 py-3">Write</th><th className="cx-label px-5 py-3">Not</th></tr></thead>
          <tbody>
            {DO_DONT.map(([yes, no]) => (
              <tr key={yes} className="border-t border-line-soft align-top">
                <td className="px-5 py-4 text-ink"><span className="mr-2 text-success">✓</span>{yes}</td>
                <td className="px-5 py-4 text-ink-muted"><span className="mr-2 text-danger">✕</span>{no}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle>Numbers</SectionTitle>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NUMBERS.map(([k, v]) => <div key={k} className="cx-card"><dt className="cx-label">{k}</dt><dd className="mono mt-2 text-[15px] leading-[22px] text-ink-body">{v}</dd></div>)}
      </dl>

      <SectionTitle note="Say what happened, what didn’t happen, and what to do next.">Errors</SectionTitle>
      <div className="cx-toast cx-toast-error max-w-[420px]" role="note">
        <div className="cx-toast-body"><strong>Swap failed</strong><span>The price moved more than 1.0%. Nothing left your wallet. Try again for a fresh quote.</span></div>
      </div>
    </>
  );
}
