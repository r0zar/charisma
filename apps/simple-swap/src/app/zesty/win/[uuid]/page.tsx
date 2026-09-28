import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getWin } from '@/lib/zesty/win';

type Props = { params: Promise<{ uuid: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const win = await getWin((await params).uuid);
  if (!win) return {};
  const title = `I called it: ZEST went ${win.side}, +${win.pct.toFixed(1)}% on Zesty`;
  const description = 'Think ZEST goes up or down? Pick a side, pick how much, walk away. Zesty sells for you, even while you sleep.';
  return { title, description, openGraph: { title, description }, twitter: { card: 'summary_large_image', title, description } };
}

/** Where a shared win lands: the result, then one button to try it. */
export default async function WinPage({ params }: Props) {
  const win = await getWin((await params).uuid);
  if (!win) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <span className="flex items-center gap-2.5">
        <span className="h-7 w-7 rounded-full bg-[#FC6432]" />
        <span className="text-[18px] font-medium tracking-[0.12em]">ZESTY</span>
      </span>
      <div className="flex flex-col gap-2">
        <span className="text-[22px] font-medium">Someone called it. ZEST went {win.side} {win.side === 'up' ? '↑' : '↓'}</span>
        <span className="text-[88px] leading-none font-medium tracking-tight text-[#1B7A3A]">+{win.pct.toFixed(1)}%</span>
      </div>
      <p className="m-0 text-[17px] leading-relaxed text-[#3D3D3D]">
        Think ZEST goes up or down? Pick a side, pick how much, and walk away. Zesty sells for you, even while you sleep.
      </p>
      <Link href="/zesty" className="flex min-h-[56px] items-center justify-center rounded-[14px] bg-[#FC6432] text-[16px] font-medium tracking-[0.08em] text-black uppercase hover:bg-[#FF7A4D]">
        Try Zesty
      </Link>
    </main>
  );
}
