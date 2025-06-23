'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { priceSeriesService, type PriceSeriesData } from '@/lib/price-series-service';

interface PriceSeriesContextType {
  initialized: boolean;
}

const PriceSeriesContext = createContext<PriceSeriesContextType>({
  initialized: false,
});

interface PriceSeriesProviderProps {
  children: ReactNode;
  initialData: PriceSeriesData;
}

export function PriceSeriesProvider({ children, initialData }: PriceSeriesProviderProps) {
  const [initialized, setInitialized] = React.useState(false);

  useEffect(() => {
    // Pre-populate the cache with the server-side fetched data
    if (initialData && Object.keys(initialData).length > 0) {
      priceSeriesService.bulkSetCachedPriceSeries(initialData);
    }
    
    setInitialized(true);
  }, [initialData]);

  return (
    <PriceSeriesContext.Provider value={{ initialized }}>
      {children}
    </PriceSeriesContext.Provider>
  );
}

export function usePriceSeriesContext() {
  return useContext(PriceSeriesContext);
}