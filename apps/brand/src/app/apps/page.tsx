import { ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';
import { PageIntro, SectionTitle } from '@/components/page-intro';

export const metadata: Metadata = { title: 'Apps' };

const APPS = [
  ['Charisma', 'charisma.rocks', 'Crest + Charisma', 'The front door. Links every app below.'],
  ['Charisma Swap', 'swap.charisma.rocks', 'App lockup', 'Swap, orders, analytics, DCA, range, in & out, fiat.'],
  ['Charisma Invest', 'invest.charisma.rocks', 'App lockup', 'Yield and liquidity pools.'],
  ['Charisma Launchpad', 'launchpad.charisma.rocks', 'App lockup', 'Deploy tokens and pools from templates.'],
  ['Charisma Tokens', 'tokens.charisma.rocks', 'App lockup', 'Token data and API.'],
  ['Charisma Metadata', 'metadata.charisma.rocks', 'App lockup', 'Token metadata hosting.'],
  ['Charisma Docs', 'docs.charisma.rocks', 'App lockup', 'Developer documentation.'],
  ['Charisma TX Monitor', 'tx.charisma.rocks', 'App lockup', 'Transaction-status API.'],
  ['Zesty', 'zesty.charisma.rocks', 'Endorsed', 'Bet on ZEST up or down in three taps. The reference for Light · Bitcoin.'],
  ['Blaze Wallet', 'wallet.charisma.rocks', 'Endorsed', 'The wallet for Stacks and Blaze subnets: sign once for orders that run on their own. In the Chrome Web Store.'],
  ['Meme Roulette', 'lol.charisma.rocks', 'Endorsed', 'A group token pump game.'],
  ['Tokemon', 'bots.charisma.rocks', 'Endorsed', 'Trading-bot manager. Coming soon.'],
  ['Lakehouse', 'lakehouse.charisma.rocks', 'Endorsed', '3D graph of the Stacks network, plus a data API.'],
];

export default function AppsPage() {
  return (
    <>
      <PageIntro eyebrow="Product family" title="Every app, one brand">
        Each live Charisma app and the lockup it uses. Every one follows the visitor’s device, with System, Light and Dark in the header toggle.
      </PageIntro>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[680px] border-collapse text-[15px] leading-[22px]">
          <thead><tr className="text-left">{['App', 'Lockup', 'What it is'].map(h => <th key={h} className="cx-label px-5 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {APPS.map(([name, host, lockup, what]) => (
              <tr key={host} className="border-t border-line-soft align-top">
                <td className="px-5 py-4">
                  <a href={`https://${host}`} className="inline-flex items-center gap-1 font-bold text-ink no-underline hover:text-accent-text">{name}<ArrowUpRight className="size-3.5" /></a>
                  <p className="mono text-[12px] text-ink-muted">{host}</p>
                </td>
                <td className="px-5 py-4 text-ink-body">{lockup}</td>
                <td className="px-5 py-4 text-ink-body">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionTitle note="OP_Predict, Innkeeper and the Blaze subnet demo have their own brands and stay out of Charisma navigation.">Not part of the family</SectionTitle>
    </>
  );
}
