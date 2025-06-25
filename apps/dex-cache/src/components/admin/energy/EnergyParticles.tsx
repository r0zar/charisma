'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';

interface Particle {
    id: string;
    x: number;
    y: number;
    color: string;
    size: number;
    duration: number;
}

interface EnergyParticlesProps {
    isActive: boolean;
    energyRate: number;
    sourceElement?: HTMLElement | null;
    targetElement?: HTMLElement | null;
}

export function EnergyParticles({
    isActive,
    energyRate,
    sourceElement,
    targetElement
}: EnergyParticlesProps) {
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        if (!isActive || energyRate <= 0) {
            setParticles([]);
            return;
        }

        // Calculate particle spawn rate based on energy rate
        const particlesPerSecond = Math.max(1, Math.min(energyRate / 1000000, 10)); // Scale appropriately
        const spawnInterval = 1000 / particlesPerSecond;

        const interval = setInterval(() => {
            const newParticle: Particle = {
                id: Math.random().toString(36),
                x: Math.random() * 100,
                y: Math.random() * 100,
                color: getRandomEnergyColor(),
                size: Math.random() * 6 + 4,
                duration: Math.random() * 2 + 1.5
            };

            setParticles(prev => [...prev.slice(-20), newParticle]); // Keep max 20 particles
        }, spawnInterval);

        return () => clearInterval(interval);
    }, [isActive, energyRate]);

    const getRandomEnergyColor = () => {
        const colors = [
            '#f59e0b', // amber
            '#10b981', // emerald  
            '#3b82f6', // blue
            '#8b5cf6', // violet
            '#f97316', // orange
            '#06b6d4'  // cyan
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    const removeParticle = (id: string) => {
        setParticles(prev => prev.filter(p => p.id !== id));
    };

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <AnimatePresence>
                {particles.map((particle) => (
                    <motion.div
                        key={particle.id}
                        initial={{
                            x: `${particle.x}%`,
                            y: `${particle.y}%`,
                            opacity: 0,
                            scale: 0
                        }}
                        animate={{
                            x: `${particle.x + (Math.random() - 0.5) * 20}%`,
                            y: `${particle.y - 30}%`,
                            opacity: [0, 1, 1, 0],
                            scale: [0, 1, 1, 0]
                        }}
                        exit={{
                            opacity: 0,
                            scale: 0
                        }}
                        transition={{
                            duration: particle.duration,
                            ease: "easeOut"
                        }}
                        onAnimationComplete={() => removeParticle(particle.id)}
                        className="absolute"
                        style={{
                            width: particle.size,
                            height: particle.size,
                            background: `radial-gradient(circle, ${particle.color}, transparent)`,
                            borderRadius: '50%',
                            filter: 'blur(1px)',
                            boxShadow: `0 0 ${particle.size}px ${particle.color}40`
                        }}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
}

interface AnimatedCounterProps {
    value: number;
    duration?: number;
    decimals?: number;
    suffix?: string;
    className?: string;
}

export function AnimatedCounter({
    value,
    duration = 0.8,
    decimals = 2,
    suffix = '',
    className = ''
}: AnimatedCounterProps) {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        const startValue = displayValue;
        const endValue = value;
        const startTime = Date.now();
        const durationMs = duration * 1000;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / durationMs, 1);
            
            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            
            const currentValue = startValue + (endValue - startValue) * easeOutQuart;
            setDisplayValue(currentValue);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [value, duration]);

    const formatValue = (val: number) => {
        return val.toLocaleString(undefined, {
            maximumFractionDigits: decimals,
            minimumFractionDigits: 0
        });
    };

    return (
        <motion.span
            className={className}
            key={value} // Force re-render on value change for highlight effect
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.3 }}
        >
            {formatValue(displayValue)}{suffix}
        </motion.span>
    );
}

interface EnergyFlowVisualizationProps {
    isActive: boolean;
    energyRate: number;
    children: React.ReactNode;
}

export function EnergyFlowVisualization({
    isActive,
    energyRate,
    children
}: EnergyFlowVisualizationProps) {
    return (
        <div className="relative">
            {children}
            
            {/* Energy Particles Overlay */}
            <EnergyParticles
                isActive={isActive}
                energyRate={energyRate}
            />

            {/* Pulsing Energy Aura */}
            {isActive && energyRate > 0 && (
                <motion.div
                    className="absolute inset-0 rounded-lg pointer-events-none"
                    animate={{
                        boxShadow: [
                            '0 0 20px rgba(59, 130, 246, 0.1)',
                            '0 0 40px rgba(59, 130, 246, 0.2)',
                            '0 0 20px rgba(59, 130, 246, 0.1)'
                        ]
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            )}
        </div>
    );
}

interface EnergyBurstEffectProps {
    trigger: boolean;
    onComplete?: () => void;
}

export function EnergyBurstEffect({ trigger, onComplete }: EnergyBurstEffectProps) {
    return (
        <AnimatePresence>
            {trigger && (
                <motion.div
                    className="absolute inset-0 pointer-events-none flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onAnimationComplete={onComplete}
                >
                    {/* Burst particles */}
                    {Array.from({ length: 12 }, (_, i) => (
                        <motion.div
                            key={i}
                            className="absolute"
                            initial={{
                                x: 0,
                                y: 0,
                                opacity: 1,
                                scale: 0
                            }}
                            animate={{
                                x: Math.cos((i * 30) * Math.PI / 180) * 60,
                                y: Math.sin((i * 30) * Math.PI / 180) * 60,
                                opacity: 0,
                                scale: 1
                            }}
                            transition={{
                                duration: 0.8,
                                ease: "easeOut"
                            }}
                        >
                            <Zap className="h-4 w-4 text-primary" />
                        </motion.div>
                    ))}
                    
                    {/* Central flash */}
                    <motion.div
                        className="absolute bg-primary rounded-full"
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 3, opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        style={{ width: 20, height: 20 }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}