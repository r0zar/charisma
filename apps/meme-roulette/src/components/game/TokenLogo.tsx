'use client';

import { useState } from 'react';
import { proxiedImage } from '@/lib/format';
import type { GameToken } from '@/contexts/tokens-context';

/** A token's logo, or its symbol's first letters when it has none or the image won't load. */
export function TokenLogo({ token, size = 24 }: { token?: GameToken; size?: number }) {
    const [broken, setBroken] = useState(false);
    if (token?.image && !broken) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={proxiedImage(token.image, size > 48 ? 128 : 64)} alt="" width={size} height={size} onError={() => setBroken(true)}
            className="shrink-0 rounded-full bg-surface-hover object-cover" style={{ width: size, height: size }} />;
    }
    return (
        <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-hover font-mono font-bold text-ink-muted"
            style={{ width: size, height: size, fontSize: Math.max(9, size * 0.32) }}>
            {(token?.symbol ?? '?').slice(0, 3)}
        </span>
    );
}
