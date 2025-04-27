import React from 'react';
import { Lock, Clock, Rocket } from 'lucide-react';
import { motion } from 'framer-motion';

interface LockOverlayProps {
    timeLeft?: number;
}

const LockOverlay = ({ timeLeft }: LockOverlayProps) => {
    // Format time if provided
    const formatTime = () => {
        if (!timeLeft) return null;
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <motion.div
            className="fixed top-0 left-0 right-0 z-40 pointer-events-none"
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
        >
            <motion.div
                className="bg-gradient-to-r from-yellow-500/90 via-orange-500/90 to-amber-500/90 backdrop-blur-sm p-3 shadow-lg border-b border-yellow-400"
                animate={{
                    boxShadow: ["0 4px 20px rgba(234, 179, 8, 0.3)", "0 4px 30px rgba(234, 179, 8, 0.6)", "0 4px 20px rgba(234, 179, 8, 0.3)"]
                }}
                transition={{
                    repeat: Infinity,
                    duration: 2
                }}
            >
                <div className="container mx-auto flex flex-col md:flex-row items-center justify-between max-w-7xl">
                    <div className="flex items-center mb-2 md:mb-0">
                        <motion.div
                            animate={{ rotate: [0, -15, 15, -15, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                            className="mr-3"
                        >
                            <Lock className="h-6 w-6 text-white" strokeWidth={1.5} />
                        </motion.div>
                        <h2 className="text-xl font-bold text-white font-display">Entries Locked!</h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center mr-3">
                            <Clock className="h-5 w-5 text-white mr-2" />
                            <span className="text-xl font-mono text-white font-bold">{formatTime()}</span>
                        </div>

                        <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="hidden md:flex items-center gap-2 bg-black/20 px-4 py-2 rounded-full"
                        >
                            <Rocket className="h-5 w-5 text-white" />
                            <span className="text-white font-semibold font-display">Pump Incoming!</span>
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            {/* Exciting pulse effect across screen */}
            <motion.div
                className="h-1 bg-yellow-400 w-full"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{
                    scaleX: [0, 1, 0],
                    opacity: [0, 1, 0],
                    x: ['-100%', '0%', '100%']
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatDelay: 1
                }}
            />
        </motion.div>
    );
};

export default LockOverlay;
