import { useState, useEffect, RefObject } from 'react';

interface CursorPosition {
    x: number;
    y: number;
}

export const useCursorPosition = (elementRef?: RefObject<HTMLElement | null>) => {
    const [position, setPosition] = useState<CursorPosition>({ x: 0, y: 0 });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const updatePosition = (e: MouseEvent) => {
            setPosition({ x: e.clientX, y: e.clientY });
        };

        const handleMouseEnter = () => {
            setIsVisible(true);
        };

        const handleMouseLeave = () => {
            setIsVisible(false);
        };

        const element = elementRef?.current;

        if (element) {
            element.addEventListener('mouseenter', handleMouseEnter);
            element.addEventListener('mouseleave', handleMouseLeave);
            element.addEventListener('mousemove', updatePosition);
        } else {
            document.addEventListener('mousemove', updatePosition);
        }

        return () => {
            if (element) {
                element.removeEventListener('mouseenter', handleMouseEnter);
                element.removeEventListener('mouseleave', handleMouseLeave);
                element.removeEventListener('mousemove', updatePosition);
            } else {
                document.removeEventListener('mousemove', updatePosition);
            }
        };
    }, [elementRef]);

    return { position, isVisible };
}; 