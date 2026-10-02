'use client';

import { useEffect, useRef } from 'react';
import { layoutSlices } from '@/lib/roulette/wheel';
import { proxiedImage } from '@/lib/format';
import { labelOn, useRealmColors } from './colors';
import { isSpinning, landsAt, rotationAt, type WheelProps } from './types';

const R = 100;
const point = (a: number, r: number) => [r * Math.sin(a), -r * Math.cos(a)] as const;
const deg = (rad: number) => (rad * 180) / Math.PI;

/**
 * The SVG wheel: the fallback when WebGL is missing or lost, and the wheel for reduced motion.
 * Same slices, same rotation function as the 3D wheel. With `still`, a spin jumps straight to where it lands.
 */
export default function Wheel2D({ slices, spin, now, tokens, mine = [], winner, dim, onLanded, still }: WheelProps & { still?: boolean }) {
    const colors = useRealmColors();
    const group = useRef<SVGGElement>(null);
    const landed = useRef(false);
    const layout = layoutSlices(slices);

    useEffect(() => {
        const g = group.current;
        if (!g) return;
        const place = (t: number) => g.setAttribute('transform', `rotate(${deg(rotationAt(spin, t))})`);
        if (!spin || still) {
            place(spin ? landsAt(spin) : 0);
            return;
        }
        landed.current = !isSpinning(spin, now());
        let frame = 0;
        const tick = () => {
            const t = now();
            place(t);
            if (isSpinning(spin, t)) frame = requestAnimationFrame(tick);
            else if (!landed.current) { landed.current = true; onLanded?.(); }
        };
        tick();
        return () => cancelAnimationFrame(frame);
    }, [spin?.drawnAt, spin?.ticket, still]);

    if (!colors) return <div className="aspect-square w-full" />;

    return (
        <svg viewBox="-118 -122 236 240" className={`w-full transition-opacity duration-500 ${dim ? 'opacity-60' : ''}`} role="img"
            aria-label={winner ? `The wheel landed on ${tokens[winner]?.symbol ?? winner}` : `The pot across ${layout.length} memes`}>
            <defs>
                <clipPath id="wheel-logo" clipPathUnits="objectBoundingBox">
                    <circle cx="0.5" cy="0.5" r="0.5" />
                </clipPath>
                <radialGradient id="lacquer" cx="50%" cy="35%" r="70%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                    <stop offset="60%" stopColor="#ffffff" stopOpacity="0.04" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
                </radialGradient>
            </defs>

            <circle r={R + 8} fill={colors.chrome} />
            <g ref={group}>
                {layout.length === 0 && <circle r={R} fill={colors.surface} stroke={colors.line} />}
                {layout.length === 1 && <circle r={R} fill={colors.slices[0]} />}
                {layout.length > 1 && layout.map((s, i) => {
                    const [x0, y0] = point(s.from, R), [x1, y1] = point(s.to, R);
                    const large = s.to - s.from > Math.PI ? 1 : 0;
                    return <path key={s.tokenId} d={`M0 0 L${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`} fill={colors.slices[i % colors.slices.length]} />;
                })}
                {layout.map((s, i) => {
                    const span = s.to - s.from;
                    if (span < 0.14) return null;
                    const mid = (s.from + s.to) / 2;
                    const [x, y] = point(mid, layout.length === 1 ? 0 : R * 0.64);
                    const size = Math.min(30, Math.max(14, span * 34));
                    const token = tokens[s.tokenId];
                    const fill = labelOn(colors.slices[i % colors.slices.length]);
                    const outlined = mine.includes(s.tokenId);
                    return (
                        <g key={s.tokenId} transform={`translate(${x} ${y}) rotate(${deg(mid)})`}>
                            {outlined && <circle r={size / 2 + 3} fill="none" stroke={colors.ink} strokeWidth="2" />}
                            {token?.image
                                ? <image href={proxiedImage(token.image, 64)} x={-size / 2} y={-size / 2} width={size} height={size}
                                    clipPath="url(#wheel-logo)" preserveAspectRatio="xMidYMid slice" />
                                : <circle r={size / 2} fill={colors.chrome} opacity="0.25" />}
                            {span > 0.3 && (
                                <text y={size / 2 + 11} textAnchor="middle" fontSize="9" fontWeight="700" fill={fill} fontFamily="var(--font-sans)">
                                    {token?.symbol ?? '?'} · {Math.round(s.share * 100)}%
                                </text>
                            )}
                        </g>
                    );
                })}
                {layout.length > 1 && layout.map(s => {
                    const [x, y] = point(s.from, R - 3);
                    return <circle key={`peg-${s.tokenId}`} cx={x} cy={y} r="2.2" fill={colors.gold} />;
                })}
                <circle r={R} fill="url(#lacquer)" />
            </g>
            <circle r={R + 4} fill="none" stroke={colors.gold} strokeWidth="5" />
            <circle r="15" fill={colors.chrome} stroke={colors.gold} strokeWidth="3" />
            <circle r="5" fill={colors.accent} />
            {/* the pointer */}
            <path d="M0 -96 L-10 -118 L10 -118 Z" fill={colors.accent} stroke={colors.chrome} strokeWidth="2" strokeLinejoin="round" />
        </svg>
    );
}
