import { ImageResponse } from 'next/og';
import { OG_SIZE, ogFonts } from '@/lib/zesty/og';
import { getPlatformStats } from '@/lib/analytics/platform-stats';
import { count, usd } from '@/components/analytics/AnalyticsPage';

export const alt = 'Charisma, by the numbers: volume, trades, traders and liquidity';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 900;

const ORANGE = '#FC6432';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 500, padding: '26px 32px', borderRadius: 24, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}>
      <div style={{ fontSize: 22, letterSpacing: 3, color: 'rgba(255,255,255,0.55)' }}>{label}</div>
      <div style={{ fontSize: 68, fontWeight: 500, color: '#fff', marginTop: 6 }}>{value}</div>
    </div>
  );
}

/** Share card: the headline numbers, live, plus a tiny weekly volume chart */
export default async function Image() {
  const stats = await getPlatformStats();
  const weeks = stats.weekly.slice(-40);
  const max = Math.max(...weeks.map(w => w.volumeUsd), 1);
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '56px 64px', background: '#0b0f17', fontFamily: 'Matter', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 500 }}>
            Charisma<span style={{ color: ORANGE, marginLeft: 14 }}>by the numbers</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, color: 'rgba(255,255,255,0.6)' }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: '#22c55e' }} />
            {count(stats.last30d.trades)} trades this month
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 40 }}>
          <Stat label="TOTAL VOLUME" value={usd(stats.volumeUsd)} />
          <Stat label="TRADES" value={count(stats.trades)} />
          <Stat label="TRADERS" value={count(stats.traders)} />
          <Stat label="LIQUIDITY" value={usd(stats.tvlUsd)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, marginTop: 'auto' }}>
          {weeks.map(w => (
            <div key={w.weekStart} style={{ flex: 1, height: `${Math.max((w.volumeUsd / max) * 100, 3)}%`, background: ORANGE, opacity: 0.8, borderRadius: 3 }} />
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
