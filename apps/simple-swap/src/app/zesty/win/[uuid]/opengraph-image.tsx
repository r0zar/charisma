import { ImageResponse } from 'next/og';
import { OG_SIZE, ogFonts } from '@/lib/zesty/og';
import { getWin } from '@/lib/zesty/win';

export const alt = 'A winning Zesty trade';
export const size = OG_SIZE;
export const contentType = 'image/png';

const ORANGE = '#FC6432';

/** The shared win: which way they called it and how much it made, in percent only. */
export default async function Image({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const win = await getWin(uuid);
  if (!win) throw new Error(`No shared win ${uuid}`);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#F7F7F7', fontFamily: 'Matter', padding: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: ORANGE }} />
          <div style={{ fontSize: 30, letterSpacing: 5, fontWeight: 500 }}>ZESTY</div>
        </div>
        <div style={{ display: 'flex', marginTop: 48, fontSize: 56, fontWeight: 500, letterSpacing: -1 }}>
          I called it. ZEST went {win.side} {win.side === 'up' ? '↑' : '↓'}
        </div>
        <div style={{ display: 'flex', marginTop: 8, fontSize: 190, lineHeight: 1, fontWeight: 500, color: '#1B7A3A', letterSpacing: -6 }}>
          +{win.pct.toFixed(1)}%
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
          <div style={{ display: 'flex', fontSize: 30, color: '#3D3D3D' }}>Pick a side. Walk away. It sells for you.</div>
          <div style={{ display: 'flex', fontSize: 24, color: '#5C5C5C' }}>zesty.charisma.rocks</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 12, background: ORANGE }} />
      </div>
    ),
    { ...size, fonts: await ogFonts() }
  );
}
