"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

interface CursorFollowingTooltipProps {
    children: React.ReactNode;
    content: React.ReactNode;
    delayDuration?: number;
    className?: string;
}

export const CursorFollowingTooltip: React.FC<CursorFollowingTooltipProps> = ({
    children,
    content,
    delayDuration = 200,
    className
}) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
    const [hasValidPosition, setHasValidPosition] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const triggerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    React.useEffect(() => {
        const updateMousePosition = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
            setHasValidPosition(true);
        };

        if (isOpen) {
            document.addEventListener('mousemove', updateMousePosition);
            // Get initial mouse position immediately
            const getInitialPosition = (e: MouseEvent) => {
                setMousePosition({ x: e.clientX, y: e.clientY });
                setHasValidPosition(true);
                document.removeEventListener('mousemove', getInitialPosition);
            };
            document.addEventListener('mousemove', getInitialPosition);
        }

        return () => {
            document.removeEventListener('mousemove', updateMousePosition);
        };
    }, [isOpen]);

    const handleMouseEnter = React.useCallback((e: React.MouseEvent) => {
        // Set initial position from the mouse enter event
        setMousePosition({ x: e.clientX, y: e.clientY });
        setHasValidPosition(true);

        timeoutRef.current = setTimeout(() => {
            setIsOpen(true);
        }, delayDuration);
    }, [delayDuration]);

    const handleMouseLeave = React.useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsOpen(false);
        setHasValidPosition(false);
    }, []);

    const getTooltipPosition = React.useMemo(() => {
        if (!mounted || typeof window === 'undefined' || !hasValidPosition) {
            return { left: 0, top: 0 };
        }

        const tooltipWidth = 400;
        const tooltipHeight = 300;
        const offset = { x: 15, y: -15 };

        let left = mousePosition.x + offset.x;
        let top = mousePosition.y + offset.y;

        // Adjust for screen edges
        if (left + tooltipWidth > window.innerWidth) {
            left = mousePosition.x - tooltipWidth - 15;
        }
        if (top + tooltipHeight > window.innerHeight) {
            top = mousePosition.y - tooltipHeight - 15;
        }
        if (left < 10) left = 10;
        if (top < 10) top = mousePosition.y + 25;

        return { left, top };
    }, [mousePosition, mounted, hasValidPosition]);

    // Only render tooltip if we have a valid position and it's open
    const shouldShowTooltip = mounted && isOpen && hasValidPosition &&
        (mousePosition.x > 0 || mousePosition.y > 0);

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{ display: 'contents' }}
            >
                {children}
            </div>

            {shouldShowTooltip && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: getTooltipPosition.left,
                        top: getTooltipPosition.top,
                        zIndex: 9999,
                        pointerEvents: 'none',
                    }}
                    className={cn(
                        "z-50 overflow-hidden rounded-lg bg-background border border-border shadow-lg backdrop-blur-sm",
                        "animate-in fade-in-0 zoom-in-[0.95] duration-200 ease-out",
                        className
                    )}
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    );
}; 