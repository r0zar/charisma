import { ImageResponse } from 'next/og';
import { OG_SIZE, ogFonts } from '@/lib/zesty/og';

export const alt = 'Zesty: think ZEST goes up or down? Pick a side, pick how much, walk away.';
export const size = OG_SIZE;
export const contentType = 'image/png';

const ORANGE = '#FC6432';

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 22, background: '#000', color: '#fff', fontSize: 22 }}>{n}</div>
      <div style={{ fontSize: 30, color: '#3D3D3D' }}>{text}</div>
    </div>
  );
}

function Side({ up }: { up: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 118, padding: '0 34px', borderRadius: 22, background: up ? ORANGE : '#000', color: up ? '#000' : '#fff' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 20, letterSpacing: 3, opacity: 0.7 }}>ZEST GOES</div>
        <div style={{ fontSize: 50, letterSpacing: 2 }}>{up ? 'UP' : 'DOWN'}</div>
      </div>
      <div style={{ fontSize: 64 }}>{up ? '↑' : '↓'}</div>
    </div>
  );
}

/** One preview for every Zesty page: what it is, in three steps. */
export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#F7F7F7', fontFamily: 'Matter', padding: 64, gap: 56 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: ORANGE }} />
            <div style={{ fontSize: 30, letterSpacing: 5, fontWeight: 500 }}>ZESTY</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 44, fontSize: 66, lineHeight: 1.05, fontWeight: 500, letterSpacing: -1 }}>
            <div>Think ZEST goes</div>
            <div style={{ display: 'flex' }}>up or down?</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 40 }}>
            <Step n={1} text="Pick a side" />
            <Step n={2} text="Pick how much" />
            <Step n={3} text="Walk away. We sell for you." />
          </div>
          <div style={{ display: 'flex', marginTop: 'auto', fontSize: 24, color: '#5C5C5C' }}>zesty.charisma.rocks</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 430, gap: 20 }}>
          <Side up />
          <Side up={false} />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8, fontSize: 24, color: '#5C5C5C' }}>Even while you sleep.</div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 12, background: ORANGE }} />
      </div>
    ),
    { ...size, fonts: await ogFonts() }
  );
}
