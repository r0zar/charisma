/**
 * A token's picture on the Trade screen: its image from Charisma's token list, or its first letter when there's none
 * or the image fails to load (as the wallet's other token icons do).
 */
import { useState } from 'react';

export function TokenPicture({ image, symbol, className }: { image: string | null; symbol: string; className: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={className}>
      {image && !broken ? <img src={image} alt="" onError={() => setBroken(true)} /> : symbol.charAt(0).toUpperCase()}
    </span>
  );
}
