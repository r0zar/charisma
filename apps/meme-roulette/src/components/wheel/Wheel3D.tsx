'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { layoutSlices, type WheelSlice } from '@/lib/roulette/wheel';
import { proxiedImage } from '@/lib/format';
import { labelOn, useRealmColors, type RealmColors } from './colors';
import { isSpinning, landsAt, rotationAt, type WheelProps, type WheelToken } from './types';

const R = 2.2;
const FACE_PX = 1024;
/** THREE.Color doesn't take #rrggbbaa */
const opaque = (hex: string) => hex.slice(0, 7);

/** Paint the wheel's face: slices, logos, symbols and odds, pegs. Logos come through the same-origin image proxy. */
function paintFace(canvas: HTMLCanvasElement, layout: WheelSlice[], colors: RealmColors, tokens: Record<string, WheelToken>,
    images: Map<string, HTMLImageElement>, mine: string[]) {
    const ctx = canvas.getContext('2d')!;
    const c = FACE_PX / 2, r = c * 0.985;
    const at = (a: number, d: number) => [c + d * Math.sin(a), c - d * Math.cos(a)] as const;
    const font = getComputedStyle(document.body).fontFamily;
    ctx.clearRect(0, 0, FACE_PX, FACE_PX);

    if (!layout.length) {
        ctx.fillStyle = colors.surface.length > 7 ? opaque(colors.chrome) : colors.surface;
        ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = colors.inkMuted;
        ctx.font = `600 44px ${font}`;
        ctx.textAlign = 'center';
        ctx.fillText('No memes backed yet', c, c - 90);
        return;
    }

    layout.forEach((s, i) => {
        ctx.fillStyle = colors.slices[i % colors.slices.length];
        ctx.beginPath();
        if (layout.length === 1) ctx.arc(c, c, r, 0, Math.PI * 2);
        else { ctx.moveTo(c, c); ctx.arc(c, c, r, s.from - Math.PI / 2, s.to - Math.PI / 2); ctx.closePath(); }
        ctx.fill();
    });

    layout.forEach((s, i) => {
        const span = s.to - s.from;
        if (span < 0.14) return;
        const mid = (s.from + s.to) / 2;
        const [x, y] = layout.length === 1 ? at(0, r * 0.46) : at(mid, r * 0.62);
        const size = Math.min(150, Math.max(64, span * 170));
        const token = tokens[s.tokenId];
        ctx.save();
        // upright while the wheel rests, so every logo and label reads the right way up
        ctx.translate(x, y);
        if (mine.includes(s.tokenId)) {
            ctx.strokeStyle = colors.ink;
            ctx.lineWidth = 9;
            ctx.beginPath(); ctx.arc(0, 0, size / 2 + 14, 0, Math.PI * 2); ctx.stroke();
        }
        const img = images.get(s.tokenId);
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.clip();
        if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
        else { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(-size / 2, -size / 2, size, size); }
        ctx.restore();
        if (!img) {
            ctx.fillStyle = labelOn(colors.slices[i % colors.slices.length]);
            ctx.font = `800 ${Math.round(size * 0.32)}px ${font}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((token?.symbol ?? '?').slice(0, 5), 0, 0);
        }
        if (span > 0.3) {
            ctx.fillStyle = labelOn(colors.slices[i % colors.slices.length]);
            ctx.font = `700 40px ${font}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(`${token?.symbol ?? '?'} · ${Math.round(s.share * 100)}%`, 0, size / 2 + 26);
        }
        ctx.restore();
    });

    if (layout.length > 1) {
        ctx.fillStyle = colors.gold;
        for (const s of layout) {
            const [x, y] = at(s.from, r - 14);
            ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
        }
    }
}

function Scene({ slices, spin, now, tokens, mine = [], onLanded, colors, onContextLost }: WheelProps & { colors: RealmColors; onContextLost: () => void }) {
    const wheel = useRef<THREE.Group>(null);
    const landed = useRef(spin ? !isSpinning(spin, now()) : false);
    const [canvas] = useState(() => {
        const el = document.createElement('canvas');
        el.width = el.height = FACE_PX;
        return el;
    });
    const [texture] = useState(() => {
        const t = new THREE.CanvasTexture(canvas);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        return t;
    });
    const [images] = useState(() => new Map<string, HTMLImageElement>());
    const { gl, invalidate } = useThree();
    const layout = layoutSlices(slices);
    const faceKey = `${layout.map(s => `${s.tokenId}:${s.stake}`).join('|')}#${mine.join(',')}#${colors.slices.join(',')}`;

    useEffect(() => {
        const repaint = () => { paintFace(canvas, layout, colors, tokens, images, mine); texture.needsUpdate = true; invalidate(); };
        repaint();
        for (const s of layout) {
            const url = tokens[s.tokenId]?.image;
            if (!url || images.has(s.tokenId)) continue;
            const img = new Image();
            img.onload = () => { images.set(s.tokenId, img); repaint(); };
            img.src = proxiedImage(url, 128);
        }
    }, [faceKey, Object.keys(tokens).length]);

    useEffect(() => {
        landed.current = spin ? !isSpinning(spin, now()) : false;
    }, [spin?.drawnAt]);

    useEffect(() => {
        const lost = (e: Event) => { e.preventDefault(); onContextLost(); };
        gl.domElement.addEventListener('webglcontextlost', lost);
        return () => gl.domElement.removeEventListener('webglcontextlost', lost);
    }, [gl]);

    useEffect(() => () => texture.dispose(), [texture]);

    useFrame(() => {
        const t = now();
        if (wheel.current) wheel.current.rotation.z = -rotationAt(spin, t);
        if (spin && !landed.current && t >= landsAt(spin)) { landed.current = true; onLanded?.(); }
    });

    return (
        <>
            <hemisphereLight args={['#ffffff', '#808080', 0.7]} />
            <directionalLight position={[2.5, 3, 6]} intensity={1.1} />
            <pointLight position={[-3, -1, 4]} intensity={18} distance={12} color={opaque(colors.gold)} />

            <group ref={wheel}>
                {/* the lacquered face */}
                <mesh position={[0, 0, 0.181]}>
                    <circleGeometry args={[R * 0.975, 128]} />
                    {/* lit for the lacquer, and lit from within so the slices keep their true colours */}
                    <meshPhysicalMaterial map={texture} emissiveMap={texture} emissive="#ffffff" emissiveIntensity={0.6}
                        roughness={0.38} clearcoat={1} clearcoatRoughness={0.1} />
                </mesh>
                {/* the body */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[R, R * 1.03, 0.36, 96]} />
                    <meshPhysicalMaterial color={opaque(colors.chrome)} roughness={0.45} metalness={0.2} clearcoat={0.6} />
                </mesh>
                {/* the rim */}
                <mesh position={[0, 0, 0.19]}>
                    <torusGeometry args={[R * 0.985, 0.07, 18, 160]} />
                    <meshStandardMaterial color={opaque(colors.gold)} metalness={0.7} roughness={0.28} />
                </mesh>
                {/* the hub */}
                <mesh position={[0, 0, 0.26]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.32, 0.36, 0.2, 48]} />
                    <meshStandardMaterial color={opaque(colors.gold)} metalness={0.7} roughness={0.25} />
                </mesh>
                <mesh position={[0, 0, 0.37]}>
                    <sphereGeometry args={[0.13, 32, 16]} />
                    <meshStandardMaterial color={opaque(colors.accent)} metalness={0.3} roughness={0.3} />
                </mesh>
            </group>

            {/* the pointer stays put at 12 o'clock */}
            <mesh position={[0, R + 0.05, 0.42]} rotation={[0, 0, Math.PI]}>
                <coneGeometry args={[0.2, 0.5, 4]} />
                <meshStandardMaterial color={opaque(colors.accent)} metalness={0.35} roughness={0.3} />
            </mesh>
        </>
    );
}

/** The lacquered 3D wheel. Its rotation is wheelRotation() of the server clock, nothing else. */
export default function Wheel3D(props: WheelProps & { onContextLost: () => void }) {
    const colors = useRealmColors();
    const [hidden, setHidden] = useState(false);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        const onVisibility = () => setHidden(document.hidden);
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    // render every frame only while the wheel is moving; otherwise only when something changes
    useEffect(() => {
        const spin = props.spin;
        if (!spin || !isSpinning(spin, props.now())) { setAnimating(false); return; }
        setAnimating(true);
        const timer = setTimeout(() => setAnimating(false), landsAt(spin) - props.now() + 250);
        return () => clearTimeout(timer);
    }, [props.spin?.drawnAt]);

    if (!colors) return <div className="aspect-square w-full" />;
    return (
        <div className={`aspect-square w-full transition-opacity duration-500 ${props.dim ? 'opacity-60' : ''}`}>
            <Canvas
                flat
                frameloop={hidden ? 'never' : animating ? 'always' : 'demand'}
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
                camera={{ position: [0, -1.9, 9.6], fov: 36 }}
                onCreated={({ camera }) => camera.lookAt(0, 0.15, 0)}
                aria-label="The roulette wheel"
            >
                <Scene {...props} colors={colors} />
            </Canvas>
        </div>
    );
}
