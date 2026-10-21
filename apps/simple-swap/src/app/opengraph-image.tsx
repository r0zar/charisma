import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OG_SIZE, ogFonts } from '@/lib/zesty/og';

export const alt = 'Charisma Swap: more liquidity sources than any other swap on Stacks';
export const size = OG_SIZE;
export const contentType = 'image/png';

const ORANGE = '#FC6432';

/** Every protocol one Charisma swap routes through, with its team's logo (public/og/protocols) */
const SOURCES = [
  { name: 'Bitflow', file: 'bitflow.svg' },
  { name: 'ALEX', file: 'alex.png' },
  { name: 'Velar', file: 'velar.png' },
  { name: 'Arkadiko', file: 'arkadiko.png' },
  { name: 'fak.fun', file: 'fakfun.png' },
  { name: 'StackingDAO', file: 'stackingdao.png' },
  { name: 'Hermetica', file: 'hermetica.png' },
  { name: 'Charisma', file: 'charisma.png' },
];

const logo = async (file: string) => {
  const data = await readFile(join(process.cwd(), 'public/og/protocols', file));
  return `data:${file.endsWith('.svg') ? 'image/svg+xml' : 'image/png'};base64,${data.toString('base64')}`;
};

/** Share card for the swap site: the sources a single swap reaches */
export default async function Image() {
  const logos = await Promise.all(SOURCES.map(s => logo(s.file)));
  return new ImageResponse(
    (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '56px 64px', background: '#0b0f17', fontFamily: 'Matter', color: '#fff' }}>
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 500 }}>
          Charisma<span style={{ color: ORANGE, marginLeft: 12 }}>Swap</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40, fontSize: 66, fontWeight: 500, lineHeight: 1.08, letterSpacing: -1 }}>
          <div style={{ display: 'flex' }}>More liquidity sources than</div>
          <div style={{ display: 'flex' }}>
            any other swap on<span style={{ color: ORANGE, marginLeft: 18 }}>Stacks</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 44 }}>
          {SOURCES.map((s, i) => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px 10px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <img src={logos[i]} width={40} height={40} style={{ borderRadius: 8, objectFit: 'contain' }} />
              <div style={{ fontSize: 26, color: 'rgba(255,255,255,0.88)' }}>{s.name}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', fontSize: 26, color: 'rgba(255,255,255,0.6)' }}>
          <div style={{ display: 'flex' }}>8 sources · One swap · 95% of the liquidity on Stacks&apos; top DEXes</div>
          <div style={{ display: 'flex', color: ORANGE }}>swap.charisma.rocks</div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
