import { MarketLive } from '@/components/market-live';
import { SiteHeader } from '@/components/site-header';
import { Ticker } from '@/components/ticker';
import { getMarket } from '@/lib/market';

export const revalidate = 60;

export default async function Home() {
  const market = await getMarket({ sparkline: true });
  const updatedAt = market.tokens.reduce((latest, t) => (t.updatedAt > latest ? t.updatedAt : latest), '') || null;
  return (
    <>
      <SiteHeader />
      <Ticker tokens={market.tokens} />
      <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 px-4 py-5">
        <h1 className="sr-only">Charisma token prices</h1>
        <MarketLive initial={{ btcUsd: market.btcUsd, updatedAt, tokens: market.tokens }} />
      </main>
    </>
  );
}
