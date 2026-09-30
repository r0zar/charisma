'use client';

import React from 'react';
import type { LimitOrder } from '@/lib/orders/types';
import type { Side } from '@/lib/zesty/plan';
import { BigButton } from './ui';

export const ZESTY_URL = 'https://zesty.charisma.rocks';

const intentUrl = (text: string, url: string) =>
  `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

/** What to post, for each moment */
export const SHARE_TEXT = {
  zesty: 'Think ZEST goes up or down? Pick a side and walk away. Zesty trades it for you 🍋',
  live: (side: Side) => `I'm betting ZEST goes ${side} on Zesty 🍋 Pick your side:`,
  finished: 'Just traded ZEST on Zesty 🍋 Pick a side, walk away:',
};

/** Open a ready-made post on X */
export function shareOnX(text: string, url = ZESTY_URL) {
  window.open(intentUrl(text, url), '_blank', 'noopener,noreferrer');
}

/** Lock in a winning trade on the server (it gets its own card), then open the post on X. */
export async function shareWin(order: LimitOrder) {
  // Open the tab now, while the tap still counts, so popup blockers allow it
  const tab = window.open('', '_blank');
  const res = await fetch(`/api/v1/zesty/win/${order.uuid}`, { method: 'POST' });
  const body = await res.json();
  if (!res.ok) {
    tab?.close();
    throw new Error(body.error ?? `Could not share this trade (${res.status})`);
  }
  const intent = intentUrl(`I called it. ZEST went ${body.side}: +${body.pct.toFixed(1)}% on Zesty 🍋`, `${ZESTY_URL}/win/${order.uuid}`);
  if (tab) tab.location.href = intent;
  else window.location.href = intent;
}

/** A full-width share button */
export function ShareButton({ text, label = 'Share on X', variant = 'outline' }: { text: string; label?: string; variant?: 'primary' | 'outline' | 'quiet' }) {
  return <BigButton variant={variant} onClick={() => shareOnX(text)}>{label}</BigButton>;
}

/** A small inline share link, for tight spots */
export function ShareLink({ text, label = 'Share on X ↗', className = '' }: { text: string; label?: string; className?: string }) {
  return (
    <button type="button" onClick={() => shareOnX(text)} className={`min-h-[44px] text-[14px] text-[#B8410F] underline underline-offset-4 hover:text-black ${className}`}>
      {label}
    </button>
  );
}
