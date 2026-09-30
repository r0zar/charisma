import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSharedTrade } from '@/lib/zesty/shared-trade';
import { formatSats } from '@/lib/zesty/format';

type Props = { params: Promise<{ uuid: string }> };

const headline = (side: string) => `I'm betting ZEST goes ${side} on Zesty`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const trade = await getSharedTrade((await params).uuid);
  if (!trade) return {};
  const title = headline(trade.side);
  const description = `Entry ${formatSats(trade.entrySats)}, target ${formatSats(trade.targetSats)}. Pick a side, walk away. Zesty trades it for you.`;
  return { title, description, openGraph: { title, description }, twitter: { card: 'summary_large_image', title, description } };
}

/** Where a shared trade lands: the call, then one button to make your own. */
export default async function TradePage({ params }: Props) {
  const trade = await getSharedTrade((await params).uuid);
  if (!trade) notFound();
  const up = trade.side === 'up';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <span className="flex items-center gap-2.5">
        <span className="h-7 w-7 rounded-full bg-[#FC6432]" />
        <span className="text-[18px] font-medium tracking-[0.12em]">ZESTY</span>
      </span>
      <div className="flex flex-col gap-3">
        <span className="text-[13px] tracking-[0.14em] text-[#5C5C5C]">{trade.state === 'live' ? 'LIVE TRADE' : trade.state === 'hit' ? 'HIT ITS TARGET' : 'CLOSED'}</span>
        <span className="text-[40px] leading-tight font-medium">Someone thinks ZEST goes {trade.side} {up ? '↑' : '↓'}</span>
        <span className="text-[20px] text-[#3D3D3D]">
          Entry <strong className="font-medium text-black">{formatSats(trade.entrySats)}</strong> → target{' '}
          <strong className="font-medium text-black">{formatSats(trade.targetSats)}</strong> ({up ? '+' : '−'}{(trade.targetPct * 100).toFixed(0)}%)
        </span>
      </div>
      <p className="m-0 text-[17px] leading-relaxed text-[#3D3D3D]">
        Think ZEST goes up or down? Pick a side, pick how much, and walk away. Zesty trades it for you, even while you sleep.
      </p>
      <Link href="/zesty" className="flex min-h-[56px] items-center justify-center rounded-[14px] bg-[#FC6432] text-[16px] font-medium tracking-[0.08em] text-black uppercase hover:bg-[#FF7A4D]">
        Make your call
      </Link>
    </main>
  );
}
