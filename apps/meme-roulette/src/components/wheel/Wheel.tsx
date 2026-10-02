'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Wheel2D from './Wheel2D';
import type { WheelProps } from './types';

// the 3D scene and three.js load only in the browser, and only when they'll be used
const Wheel3D = dynamic(() => import('./Wheel3D'), { ssr: false, loading: () => <div className="aspect-square w-full" /> });

type Mode = 'pending' | '3d' | '2d' | 'still';

function pickMode(): Mode {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'still';
    const probe = document.createElement('canvas');
    return probe.getContext('webgl2') || probe.getContext('webgl') ? '3d' : '2d';
}

/** The 3D wheel where WebGL works; the SVG wheel when it doesn't, when the context is lost, or for reduced motion. */
export function Wheel(props: WheelProps) {
    const [mode, setMode] = useState<Mode>('pending');
    useEffect(() => setMode(pickMode()), []);

    if (mode === 'pending') return <div className="aspect-square w-full" />;
    if (mode === '3d') return <Wheel3D {...props} onContextLost={() => setMode('2d')} />;
    return <Wheel2D {...props} still={mode === 'still'} />;
}
