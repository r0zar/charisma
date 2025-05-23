"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useCursorPosition } from "@/hooks/useCursorPosition"
import { cn } from "@/lib/utils"

interface CursorTooltipProps {
    children: React.ReactNode;
    content: React.ReactNode;
    className?: string;
    offset?: { x: number; y: number };
    delayDuration?: number;
}

export const CursorTooltip: React.FC<CursorTooltipProps> = ({
    children,
    content,
    className,
    offset = { x: 15, y: -15 },
    delayDuration = 200
}) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const [showTooltip, setShowTooltip] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);
    const triggerRef = React.useRef<HTMLDivElement>(null);
    const timeoutRef = React.useRef<NodeJS.Timeout>();

    const { position } = useCursorPosition(triggerRef);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    React.useEffect(() => {
        if (isHovered) {
            timeoutRef.current = setTimeout(() => {
                setShowTooltip(true);
            }, delayDuration);
        } else {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            setShowTooltip(false);
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [isHovered, delayDuration]);

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const tooltipStyle = {
        position: 'fixed' as const,
        left: position.x + offset.x,
        top: position.y + offset.y,
        zIndex: 9999,
        pointerEvents: 'none' as const,
    };

    // Adjust position if tooltip would go off screen
    const adjustedStyle = React.useMemo(() => {
        if (typeof window === 'undefined') return tooltipStyle;

        const adjustedLeft = Math.min(
            position.x + offset.x,
            window.innerWidth - 400 // Assuming max tooltip width of 400px
        );
        const adjustedTop = Math.max(
            position.y + offset.y,
            10 // Minimum distance from top
        );

        return {
            ...tooltipStyle,
            left: Math.max(adjustedLeft, 10), // Minimum distance from left
            top: adjustedTop,
        };
    }, [position.x, position.y, offset.x, offset.y]);

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="inline-block w-full"
            >
                {children}
            </div>

            {mounted && showTooltip && createPortal(
                <AnimatePresence>
                    <motion.div
                        style={adjustedStyle}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{
                            duration: 0.2,
                            ease: [0.16, 1, 0.3, 1]
                        }}
                        className={cn(
                            "z-50 overflow-hidden rounded-lg bg-background border border-border shadow-lg backdrop-blur-sm",
                            "max-w-none", // Override any max-width restrictions
                            className
                        )}
                    >
                        {content}
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}; 