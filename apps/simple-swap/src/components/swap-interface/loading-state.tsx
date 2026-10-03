"use client";

import React, { useEffect, useRef } from 'react';
import { useSwapTokens } from '@/contexts/swap-tokens-context';

// Liquid Orbit: five crimson drops circle a sixth, pull together into one coin bearing the mark, hold, and burst back out.
// The drops melt into each other through a blur + alpha-threshold filter (metaballs). It is all native SVG animation,
// so it moves from the first server-rendered paint, before any script runs
const CX = 200, CY = 135, LOOP = '3.6s';
// orbit → gather (1.1s–1.75s) → hold as a coin → burst (2.75s–3.25s) → orbit
const PHASES = { keyTimes: '0;.3056;.4861;.7639;.8333;.9028;1', keySplines: '0 0 1 1;.65 0 .35 1;0 0 1 1;.2 .8 .4 1;.65 0 .35 1;0 0 1 1' };
// the mark fades in once the coin has formed (1.7s–1.95s), with a small pop, and out just before the burst
const COIN = { keyTimes: '0;.4722;.5417;.75;.7778;1', keySplines: '0 0 1 1;.2 .8 .4 1;0 0 1 1;.65 0 .35 1;0 0 1 1' };

function Animate({ attribute, values, timing = PHASES }: { attribute: string; values: string; timing?: typeof PHASES }) {
    return <animate attributeName={attribute} values={values} dur={LOOP} repeatCount="indefinite" calcMode="spline" {...timing} />;
}

// One set of drops. Drawn twice: once through the goo filter for the liquid, once on top for each drop's glassy highlight
function Drops({ fill, shine }: { fill: string; shine?: boolean }) {
    return (
        <g>
            <g>
                <animateTransform attributeName="transform" type="rotate" from={`0 ${CX} ${CY}`} to={`360 ${CX} ${CY}`} dur={LOOP} repeatCount="indefinite" />
                {[0, 1, 2, 3, 4].map(i => (
                    <g key={i} transform={`rotate(${i * 72} ${CX} ${CY})`}>
                        <g>
                            <animateTransform attributeName="transform" type="translate" values="74 0;74 0;0 0;0 0;84 0;74 0;74 0" dur={LOOP} repeatCount="indefinite" calcMode="spline" {...PHASES} />
                            {/* turns back against the orbit, so the light always falls from the top left */}
                            <g>
                                <animateTransform attributeName="transform" type="rotate" from={`${-i * 72} ${CX} ${CY}`} to={`${-i * 72 - 360} ${CX} ${CY}`} dur={LOOP} repeatCount="indefinite" />
                                <circle cx={CX} cy={CY} r="19" fill={fill}>
                                    <Animate attribute="r" values="19;19;12;12;17;19;19" />
                                    {shine && <Animate attribute="opacity" values=".75;.75;.08;.08;.6;.75;.75" />}
                                </circle>
                            </g>
                        </g>
                    </g>
                ))}
            </g>
            <circle cx={CX} cy={CY} r="14" fill={fill} opacity={shine ? 0.9 : 1}>
                <Animate attribute="r" values="14;14;52;52;20;14;14" />
            </circle>
        </g>
    );
}

export default function LoadingState() {
    const { isInitializing, isLoadingTokens } = useSwapTokens();
    const step = isInitializing ? 'Connecting' : isLoadingTokens ? 'Loading tokens' : 'Finding the best routes';
    const svgRef = useRef<SVGSVGElement>(null);

    // Reduced motion holds the formed coin
    useEffect(() => {
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        svgRef.current?.setCurrentTime(2.2);
        svgRef.current?.pauseAnimations();
    }, []);

    return (
        <div className="max-w-2xl mx-auto">
            <style>{`
                .cx-loader-line { animation: cx-loader-fade 0.6s ease-out both; }
                @keyframes cx-loader-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
                @media (prefers-reduced-motion: reduce) { .cx-loader-line { animation: none; } }
            `}</style>
            <div className="bg-surface-sunken border border-line-soft rounded-2xl p-8">
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4" role="status" aria-live="polite">
                    <svg ref={svgRef} viewBox="80 30 240 220" className="h-[220px] w-[240px]" aria-hidden>
                        <defs>
                            <filter id="cx-orbit-goo" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
                                <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" result="goo" />
                                <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                            </filter>
                            <radialGradient id="cx-orbit-drop" cx="38%" cy="32%" r="75%">
                                <stop offset="0" stopColor="#ff7a85" />
                                <stop offset="0.45" stopColor="#d6202d" />
                                <stop offset="1" stopColor="#6e0710" />
                            </radialGradient>
                            <radialGradient id="cx-orbit-shine" cx="29%" cy="23%" r="22%">
                                <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
                                <stop offset="1" stopColor="#fff" stopOpacity="0" />
                            </radialGradient>
                        </defs>
                        <ellipse cx={CX} cy="232" rx="80" ry="8" fill="#000" opacity="0.15">
                            <Animate attribute="rx" values="80;80;40;40;86;80;80" />
                        </ellipse>
                        <g filter="url(#cx-orbit-goo)">
                            <Drops fill="url(#cx-orbit-drop)" />
                        </g>
                        <Drops fill="url(#cx-orbit-shine)" shine />
                        <g transform={`translate(${CX} ${CY})`}>
                            <g>
                                <animateTransform attributeName="transform" type="scale" values=".8;.8;1;1;1;1" dur={LOOP} repeatCount="indefinite" calcMode="spline" {...COIN} />
                                <image href="/charisma.png" x="-32" y="-32" width="64" height="64" opacity="0">
                                    <Animate attribute="opacity" values="0;0;.95;.95;0;0" timing={COIN} />
                                </image>
                            </g>
                        </g>
                    </svg>
                    <p key={step} className="cx-loader-line font-mono text-xs uppercase tracking-[0.16em] text-ink-muted">{step}…</p>
                </div>
            </div>
        </div>
    );
}
