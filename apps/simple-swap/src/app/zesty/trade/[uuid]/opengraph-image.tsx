import { ImageResponse } from 'next/og';
import { OG_SIZE, ogFonts } from '@/lib/zesty/og';
import { getSharedTrade } from '@/lib/zesty/shared-trade';
import { formatSats } from '@/lib/zesty/format';

export const alt = 'A Zesty trade: which way ZEST goes, entry and target';
export const size = OG_SIZE;
export const contentType = 'image/png';

const ORANGE = '#FC6432';
const STATE = { live: 'LIVE', hit: 'HIT TARGET', closed: 'CLOSED' } as const;

/** The shared call: side, entry and target in sats. No amounts, no address. */
export default async function Image({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const trade = await getSharedTrade(uuid);
  if (!trade) throw new Error(`No shareable Zesty trade ${uuid}`);
  const up = trade.side === 'up';

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#F7F7F7', fontFamily: 'Matter', padding: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: ORANGE }} />
            <div style={{ fontSize: 30, letterSpacing: 5, fontWeight: 500 }}>ZESTY</div>
          </div>
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 500, letterSpacing: 3, padding: '8px 20px', borderRadius: 999, background: trade.state === 'live' ? ORANGE : '#E5E5E5', color: 'black' }}>
            {STATE[trade.state]}
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 48, fontSize: 64, fontWeight: 500, letterSpacing: -1 }}>
          I&apos;m betting ZEST goes {trade.side} {up ? '↑' : '↓'}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 36, marginTop: 36 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 84, fontWeight: 500, letterSpacing: -2 }}>{formatSats(trade.entrySats)}</div>
            <div style={{ display: 'flex', fontSize: 26, color: '#5C5C5C' }}>entry</div>
          </div>
          <div style={{ display: 'flex', fontSize: 72, color: ORANGE, paddingBottom: 40 }}>→</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 84, fontWeight: 500, letterSpacing: -2, color: '#1B7A3A' }}>{formatSats(trade.targetSats)}</div>
            <div style={{ display: 'flex', fontSize: 26, color: '#5C5C5C' }}>target ({up ? '+' : '−'}{(trade.targetPct * 100).toFixed(0)}%)</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
          <div style={{ display: 'flex', fontSize: 30, color: '#3D3D3D' }}>Pick a side. Walk away. It trades for you.</div>
          <div style={{ display: 'flex', fontSize: 24, color: '#5C5C5C' }}>zesty.charisma.rocks</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 12, background: ORANGE }} />
      </div>
    ),
    { ...size, fonts: await ogFonts() }
  );
}
