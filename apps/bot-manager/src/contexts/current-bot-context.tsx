'use client';

import React, { createContext, useContext } from 'react';
import { Bot } from '@/schemas/bot.schema';

interface CurrentBotContextType {
  bot: Bot | null;
  loading: boolean;
}

const CurrentBotContext = createContext<CurrentBotContextType | undefined>(undefined);

export const useCurrentBot = () => {
  const context = useContext(CurrentBotContext);
  if (!context) {
    throw new Error('useCurrentBot must be used within a CurrentBotProvider');
  }
  return context;
};

interface CurrentBotProviderProps {
  children: React.ReactNode;
  bot: Bot | null;
  loading: boolean;
}

export function CurrentBotProvider({ children, bot, loading }: CurrentBotProviderProps) {
  return (
    <CurrentBotContext.Provider value={{ bot, loading }}>
      {children}
    </CurrentBotContext.Provider>
  );
}