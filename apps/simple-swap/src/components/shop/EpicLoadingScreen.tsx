"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    Package,
    Users,
    Clock,
    Sparkles,
    Zap,
    ShoppingBag,
    Crown,
    Coins,
    Star,
    Rocket,
    Diamond,
    Bolt
} from 'lucide-react';

interface LoadingStage {
    id: string;
    label: string;
    icon: React.ComponentType<any>;
    duration: number;
    color: string;
    bgGradient: string;
    particles: number;
}

const loadingStages: LoadingStage[] = [
    {
        id: 'initializing',
        label: 'Initializing Marketplace',
        icon: Rocket,
        duration: 1000,
        color: 'text-blue-400',
        bgGradient: 'from-blue-900/20 to-blue-600/10',
        particles: 15
    },
    {
        id: 'connecting',
        label: 'Connecting to Charisma Network',
        icon: Bolt,
        duration: 800,
        color: 'text-purple-400',
        bgGradient: 'from-purple-900/20 to-purple-600/10',
        particles: 20
    },
    {
        id: 'loading-offers',
        label: 'Loading Active Offers',
        icon: Package,
        duration: 1200,
        color: 'text-green-400',
        bgGradient: 'from-green-900/20 to-green-600/10',
        particles: 25
    },
    {
        id: 'syncing-prices',
        label: 'Syncing Market Prices',
        icon: TrendingUp,
        duration: 900,
        color: 'text-yellow-400',
        bgGradient: 'from-yellow-900/20 to-yellow-600/10',
        particles: 30
    },
    {
        id: 'finalizing',
        label: 'Finalizing Experience',
        icon: Crown,
        duration: 800,
        color: 'text-pink-400',
        bgGradient: 'from-pink-900/20 to-pink-600/10',
        particles: 40
    }
];

const FloatingParticle = ({ delay, duration, color }: { delay: number; duration: number; color: string }) => (
    <motion.div
        className={`absolute w-1 h-1 ${color} rounded-full opacity-70`}
        style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
        }}
        animate={{
            y: [-20, -80, -20],
            x: [0, Math.random() * 40 - 20, 0],
            opacity: [0, 1, 0],
            scale: [0, 1, 0]
        }}
        transition={{
            duration: duration,
            delay: delay,
            repeat: Infinity,
            ease: "easeInOut"
        }}
    />
);

const ProgressRing = ({ progress, size = 120 }: { progress: number; size?: number }) => {
    const radius = (size - 8) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative">
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-muted/20"
                />
                {/* Progress ring */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="url(#progressGradient)"
                    strokeWidth="4"
                    fill="transparent"
                    strokeLinecap="round"
                    style={{
                        strokeDasharray: circumference,
                        strokeDashoffset
                    }}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                />
                {/* Gradient definition */}
                <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#8B5CF6" />
                        <stop offset="50%" stopColor="#EC4899" />
                        <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Progress text */}
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {Math.round(progress)}%
                </span>
            </div>
        </div>
    );
};

const EpicLoadingScreen = () => {
    const [currentStageIndex, setCurrentStageIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [startTime] = useState(Date.now());

    const currentStage = loadingStages[currentStageIndex];
    const StageIcon = currentStage?.icon || Sparkles;

    useEffect(() => {
        let progressInterval: NodeJS.Timeout;
        let stageTimeout: NodeJS.Timeout;

        const startStage = (stageIndex: number) => {
            if (stageIndex >= loadingStages.length) {
                // Ensure minimum display time of 4.7 seconds (sum of all durations)
                const minDisplayTime = 4700; // Total duration of all stages
                const elapsed = Date.now() - startTime;
                const remainingTime = Math.max(0, minDisplayTime - elapsed);

                setTimeout(() => {
                    setIsExiting(true);
                    // Complete after exit animation
                    setTimeout(() => {
                        setIsComplete(true);
                    }, 800); // Exit animation duration
                }, remainingTime);
                return;
            }

            setCurrentStageIndex(stageIndex);
            const stage = loadingStages[stageIndex];
            const stageProgress = (stageIndex / loadingStages.length) * 100;
            const nextStageProgress = ((stageIndex + 1) / loadingStages.length) * 100;

            // Animate progress for this stage
            let currentProgress = stageProgress;
            progressInterval = setInterval(() => {
                currentProgress += (nextStageProgress - stageProgress) / (stage.duration / 50);
                if (currentProgress >= nextStageProgress) {
                    currentProgress = nextStageProgress;
                    clearInterval(progressInterval);
                }
                setProgress(currentProgress);
            }, 50);

            // Move to next stage
            stageTimeout = setTimeout(() => {
                clearInterval(progressInterval);
                startStage(stageIndex + 1);
            }, stage.duration);
        };

        startStage(0);

        return () => {
            clearInterval(progressInterval);
            clearTimeout(stageTimeout);
        };
    }, [startTime]);

    if (isComplete) {
        return null; // Component will unmount and show the actual content
    }

    return (
        <motion.div
            className="fixed inset-0 bg-background/95 backdrop-blur-lg z-50 overflow-hidden"
            initial={{ opacity: 1 }}
            animate={{ opacity: isExiting ? 0 : 1 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
        >
            {/* Animated Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${currentStage?.bgGradient}`} />

            {/* Floating Particles */}
            <div className="absolute inset-0">
                {Array.from({ length: currentStage?.particles || 20 }).map((_, i) => (
                    <FloatingParticle
                        key={`${currentStage?.id}-${i}`}
                        delay={i * 0.1}
                        duration={3 + Math.random() * 2}
                        color={currentStage?.color || 'text-primary'}
                    />
                ))}
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
                {/* Logo/Brand Section */}
                <motion.div
                    className="mb-8"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                >
                    <div className="relative">
                        <motion.div
                            className="p-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-2xl"
                            animate={{
                                boxShadow: [
                                    "0 0 30px rgba(168, 85, 247, 0.4)",
                                    "0 0 60px rgba(236, 72, 153, 0.6)",
                                    "0 0 30px rgba(168, 85, 247, 0.4)"
                                ]
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <Diamond className="h-12 w-12 text-white" />
                        </motion.div>

                        {/* Orbiting elements */}
                        {[Coins, Star, Zap].map((Icon, index) => (
                            <motion.div
                                key={index}
                                className="absolute top-1/2 left-1/2"
                                style={{
                                    transformOrigin: `${35 + index * 10}px 0px`
                                }}
                                animate={{ rotate: 360 }}
                                transition={{
                                    duration: 4 + index * 2,
                                    repeat: Infinity,
                                    ease: "linear"
                                }}
                            >
                                <div className={`p-2 rounded-full bg-gradient-to-r ${index === 0 ? 'from-yellow-400 to-orange-400' :
                                    index === 1 ? 'from-blue-400 to-cyan-400' :
                                        'from-green-400 to-emerald-400'
                                    } shadow-lg`}>
                                    <Icon className="h-4 w-4 text-white" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Title */}
                <motion.div
                    className="text-center mb-8"
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                >
                    <h1 className="text-4xl md:text-6xl font-bold mb-4">
                        <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent">
                            Charisma
                        </span>
                        <br />
                        <span className="text-2xl md:text-4xl text-muted-foreground">
                            Marketplace
                        </span>
                    </h1>
                    <motion.p
                        className="text-lg text-muted-foreground max-w-md mx-auto"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 0.8 }}
                    >
                        Experience the future of decentralized trading
                    </motion.p>
                </motion.div>

                {/* Progress Ring */}
                <motion.div
                    className="mb-8"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8, duration: 0.6 }}
                >
                    <ProgressRing progress={progress} />
                </motion.div>

                {/* Current Stage */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStage?.id}
                        className="text-center space-y-4"
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -30, opacity: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <motion.div
                            className={`inline-flex items-center gap-3 px-6 py-3 rounded-full bg-card/50 backdrop-blur-sm border border-border/50 ${currentStage?.color}`}
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            >
                                <StageIcon className="h-5 w-5" />
                            </motion.div>
                            <span className="font-medium text-foreground">
                                {currentStage?.label}
                            </span>
                        </motion.div>

                        {/* Loading dots */}
                        <div className="flex justify-center gap-1">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 bg-primary rounded-full"
                                    animate={{
                                        scale: [1, 1.5, 1],
                                        opacity: [0.5, 1, 0.5]
                                    }}
                                    transition={{
                                        duration: 1,
                                        delay: i * 0.2,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                    }}
                                />
                            ))}
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* Stats Preview */}
                <motion.div
                    className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto"
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.5, duration: 0.8 }}
                >
                    {[
                        { icon: Package, label: 'Active Offers', value: '∞' },
                        { icon: Users, label: 'Traders', value: '∞' },
                        { icon: TrendingUp, label: 'Volume', value: '∞' },
                        { icon: Clock, label: 'Uptime', value: '100%' }
                    ].map((stat, index) => (
                        <motion.div
                            key={index}
                            className="text-center space-y-2 p-4 rounded-lg bg-card/30 backdrop-blur-sm border border-border/30"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 1.8 + index * 0.1, duration: 0.4 }}
                        >
                            <stat.icon className="h-6 w-6 mx-auto text-primary" />
                            <div className="text-lg font-bold text-foreground">{stat.value}</div>
                            <div className="text-xs text-muted-foreground">{stat.label}</div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>

            {/* Bottom Corner Branding */}
            <motion.div
                className="absolute bottom-6 right-6 text-xs text-muted-foreground/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2, duration: 1 }}
            >
                Powered by Charisma Protocol
            </motion.div>
        </motion.div>
    );
};

export default EpicLoadingScreen; 