'use client'; // This hook uses client-side APIs

import { useState, useEffect } from 'react';

interface Size {
    width: number;
    height: number;
}

function useWindowSize(): Size {
    const [size, setSize] = useState<Size>({
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return; // Don't run on server
        }

        const handleResize = () => {
            setSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);
        // Call handler right away so state gets updated with initial window size
        // handleResize(); // Already set initial state above

        // Remove event listener on cleanup
        return () => window.removeEventListener('resize', handleResize);
    }, []); // Empty array ensures that effect is only run on mount and unmount

    return size;
}

export default useWindowSize; 