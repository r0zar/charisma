'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';

/** A steady color per symbol, so each token's letter badge looks the same everywhere */
const hue = (symbol: string) => [...symbol].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/** A token's logo. When there's none, or it fails to load, its first letter on a colored badge. */
export function TokenLogo({ src, symbol, size = 28 }: { src?: string; symbol: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // An image that failed before the page came alive never fires onError, so check once on mount too.
  // Tiny images are real: DMT's logo is a single on-chain pixel, shown here as a solid circle.
  const check = (el: HTMLImageElement | null) => { if (el?.complete && el.naturalWidth === 0) setBroken(true); };
  useEffect(() => check(img.current), [src]);
  const style = { width: size, height: size };
  if (!src || broken) {
    return (
      <span
        aria-hidden
        style={{ ...style, background: `hsl(${hue(symbol)} 45% 38%)`, fontSize: Math.max(9, size * 0.42) }}
        className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      >
        {(symbol.replace(/[^a-z0-9]/gi, '')[0] ?? '?').toUpperCase()}
      </span>
    );
  }
  return <img ref={img} src={src} alt="" style={style} loading="lazy" onError={() => setBroken(true)} className="shrink-0 rounded-full bg-surface-raised object-cover [image-rendering:pixelated]" />;
}
