"use client";

import React from 'react';
import { useSwapTokens } from '@/contexts/swap-tokens-context';

// One brush stroke circling the mark: it grows, sweeps and shrinks while the whole ring turns, and the mark breathes
const LOADER_CSS = `
.cx-loader-ring { animation: cx-loader-turn 1.8s linear infinite; }
.cx-loader-arc { stroke-dasharray: 1 100; animation: cx-loader-sweep 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 45%, transparent)); }
.cx-loader-mark { animation: cx-loader-breathe 2.4s ease-in-out infinite alternate; }
.cx-loader-line { animation: cx-loader-fade 0.6s ease-out both; }
@keyframes cx-loader-turn { to { transform: rotate(360deg); } }
@keyframes cx-loader-sweep {
  0% { stroke-dasharray: 1 100; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 62 100; stroke-dashoffset: -14; }
  100% { stroke-dasharray: 1 100; stroke-dashoffset: -99; }
}
@keyframes cx-loader-breathe { from { transform: scale(0.95); opacity: 0.85; } to { transform: scale(1); opacity: 1; } }
@keyframes cx-loader-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .cx-loader-ring, .cx-loader-mark, .cx-loader-line { animation: none; }
  .cx-loader-arc { animation: none; stroke-dasharray: 25 100; }
}
`;

export default function LoadingState() {
    const { isInitializing, isLoadingTokens } = useSwapTokens();
    const step = isInitializing ? 'Connecting' : isLoadingTokens ? 'Loading tokens' : 'Finding the best routes';

    return (
        <div className="max-w-2xl mx-auto">
            <style>{LOADER_CSS}</style>
            <div className="bg-surface-sunken border border-line-soft rounded-2xl p-8">
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-6" role="status" aria-live="polite">
                    <div className="relative h-28 w-28">
                        <svg viewBox="0 0 100 100" className="cx-loader-ring absolute inset-0 h-full w-full" aria-hidden>
                            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--line)" strokeWidth="1.5" />
                            <circle
                                cx="50" cy="50" r="44" fill="none" pathLength={100}
                                stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"
                                className="cx-loader-arc"
                            />
                        </svg>
                        <img src="/charisma.png" alt="" className="cx-loader-mark absolute inset-[26px] h-14 w-14 rounded-full" />
                    </div>
                    <p key={step} className="cx-loader-line text-sm text-ink-muted">{step}…</p>
                </div>
            </div>
        </div>
    );
}
