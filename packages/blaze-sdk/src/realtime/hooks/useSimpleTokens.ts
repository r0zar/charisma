'use client';

import { useContext } from 'react';
import { TokensContext } from '../providers/SimpleTokensProvider';

export const useTokensConnection = () => {
  const context = useContext(TokensContext);
  
  if (context === undefined) {
    throw new Error('useTokensConnection must be used within a TokensProvider');
  }

  return {
    isConnected: context.isConnected,
    connectionMode: 'realtime' as const,
    lastUpdate: Date.now()
  };
};