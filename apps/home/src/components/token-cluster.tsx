import type { CSSProperties } from 'react';

export type Coin = { src: string; label: string; style: CSSProperties; pixel?: boolean };

/** Overlapping coins, each bobbing on its own beat (still under reduced motion) */
export function TokenCluster({ coins }: { coins: Coin[] }) {
  return (
    <div className="token-cluster relative h-[280px] w-[280px] sm:h-[360px] sm:w-[360px]" role="img" aria-label={coins.map(c => c.label).join(', ')}>
      {coins.map(c => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={c.src} src={c.src} alt="" className="bob absolute rounded-full" style={{ ...c.style, imageRendering: c.pixel ? 'pixelated' : undefined }} />
      ))}
    </div>
  );
}
