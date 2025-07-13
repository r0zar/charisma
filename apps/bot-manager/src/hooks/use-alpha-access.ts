'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Hook to check if the user has alpha access via URL fragment
 * Returns true if current URL contains #alpha fragment
 */
export function useAlphaAccess(): boolean {
  const [hasAlphaAccess, setHasAlphaAccess] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Check if we're on client side
    if (typeof window === 'undefined') {
      return;
    }

    const checkAlphaAccess = () => {
      const hash = window.location.hash;
      const hasAlpha = hash === '#alpha';
      setHasAlphaAccess(hasAlpha);
    };

    // Check immediately
    checkAlphaAccess();

    // Listen for hash changes
    const handleHashChange = () => {
      checkAlphaAccess();
    };

    window.addEventListener('hashchange', handleHashChange);

    // Clean up listener
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [pathname]);

  return hasAlphaAccess;
}