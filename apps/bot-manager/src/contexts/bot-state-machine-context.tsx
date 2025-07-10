'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Bot } from '@/schemas/bot.schema';
import { BotStateMachine, TransitionResult } from '@/lib/infrastructure/state-machine/bot-state-machine';
import { useWallet } from './wallet-context';
import { useToast } from './toast-context';
import { useBots } from './bot-context';

interface StateMachineTransition {
  botId: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  transitionId: string;
  timestamp: string;
  success: boolean;
  warnings?: string[];
}

interface BotStateMachineContextType {
  // State management
  isTransitioning: boolean;
  lastTransition: StateMachineTransition | null;
  
  // Core transition methods
  transitionBot: (bot: Bot, action: string, reason?: string) => Promise<Bot | null>;
  
  // Convenience methods for common transitions
  startBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  pauseBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  stopBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  resumeBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  resetBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  abandonBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  reactivateBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  errorBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  
  // State queries
  getAvailableActions: (bot: Bot) => string[];
  getRecommendedActions: (bot: Bot) => string[];
  isActionAvailable: (bot: Bot, action: string) => boolean;
  getStatusDescription: (bot: Bot) => string;
  
  // Validation
  validateTransition: (bot: Bot, action: string) => Promise<{
    isValid: boolean;
    errors: string[];
    warnings?: string[];
  }>;
}

const BotStateMachineContext = createContext<BotStateMachineContextType | undefined>(undefined);

export function BotStateMachineProvider({ children }: { children: React.ReactNode }) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [lastTransition, setLastTransition] = useState<StateMachineTransition | null>(null);
  
  const { getUserId, authenticatedFetchWithTimestamp } = useWallet();
  const { showSuccess, showError, showWarning } = useToast();
  const { refreshData } = useBots();

  /**
   * Core transition method - handles all state changes through the API
   */
  const transitionBot = useCallback(async (
    bot: Bot,
    action: string,
    reason?: string
  ): Promise<Bot | null> => {
    if (isTransitioning) {
      showError('Transition in progress', 'Please wait for current transition to complete');
      return null;
    }

    setIsTransitioning(true);

    try {
      const userId = getUserId();
      const message = `bot_transition_${bot.id}_${action}`;

      const response = await authenticatedFetchWithTimestamp(
        `/api/v1/bots/${bot.id}/transitions?userId=${encodeURIComponent(userId)}`,
        {
          method: 'POST',
          message,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action,
            reason
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${action} bot`);
      }

      const result = await response.json();
      const { bot: updatedBot, transition } = result;

      // Record the transition
      const transitionRecord: StateMachineTransition = {
        botId: bot.id,
        action,
        fromStatus: transition.fromStatus,
        toStatus: transition.toStatus,
        transitionId: transition.transitionId,
        timestamp: transition.timestamp,
        success: true,
        warnings: transition.warnings
      };
      setLastTransition(transitionRecord);

      // Show success notification
      const actionNames = {
        start: 'started',
        pause: 'paused',
        stop: 'stopped',
        resume: 'resumed',
        reset: 'reset',
        abandon: 'abandoned',
        reactivate: 'reactivated',
        error: 'marked as error'
      };
      const actionName = actionNames[action as keyof typeof actionNames] || action;
      
      showSuccess(
        `Bot ${actionName}`,
        `${bot.name} has been ${actionName} successfully`
      );

      // Show warnings if any
      if (transition.warnings && transition.warnings.length > 0) {
        transition.warnings.forEach((warning: string) => {
          showWarning('Transition Warning', warning);
        });
      }

      // Refresh bot data to ensure UI is updated with new state
      try {
        await refreshData();
      } catch (refreshError) {
        console.warn('Failed to refresh bot data after transition:', refreshError);
        // Don't fail the transition if refresh fails
      }

      return updatedBot;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Record failed transition
      const transitionRecord: StateMachineTransition = {
        botId: bot.id,
        action,
        fromStatus: bot.status,
        toStatus: bot.status, // No change on failure
        transitionId: `failed_${Date.now()}`,
        timestamp: new Date().toISOString(),
        success: false
      };
      setLastTransition(transitionRecord);

      showError(`Failed to ${action} bot`, errorMessage);
      return null;
    } finally {
      setIsTransitioning(false);
    }
  }, [isTransitioning, getUserId, authenticatedFetchWithTimestamp, showSuccess, showError, showWarning, refreshData]);

  // Convenience methods for specific transitions
  const startBot = useCallback((bot: Bot, reason?: string) => 
    transitionBot(bot, 'start', reason), [transitionBot]);
  
  const pauseBot = useCallback((bot: Bot, reason?: string) => 
    transitionBot(bot, 'pause', reason), [transitionBot]);
  
  const stopBot = useCallback((bot: Bot, reason?: string) => 
    transitionBot(bot, 'stop', reason), [transitionBot]);
  
  const resumeBot = useCallback((bot: Bot, reason?: string) => 
    transitionBot(bot, 'resume', reason), [transitionBot]);
  
  const resetBot = useCallback((bot: Bot, reason?: string) => 
    transitionBot(bot, 'reset', reason), [transitionBot]);
  
  const abandonBot = useCallback((bot: Bot, reason?: string) => 
    transitionBot(bot, 'abandon', reason), [transitionBot]);
  
  const reactivateBot = useCallback((bot: Bot, reason?: string) => 
    transitionBot(bot, 'reactivate', reason), [transitionBot]);
  
  const errorBot = useCallback((bot: Bot, reason?: string) => 
    transitionBot(bot, 'error', reason), [transitionBot]);

  // State query methods
  const getAvailableActions = useCallback((bot: Bot) => 
    BotStateMachine.getAvailableActions(bot), []);
  
  const getRecommendedActions = useCallback((bot: Bot) => 
    BotStateMachine.getRecommendedActions(bot), []);
  
  const isActionAvailable = useCallback((bot: Bot, action: string) => 
    BotStateMachine.isActionAvailable(bot, action), []);
  
  const getStatusDescription = useCallback((bot: Bot) => 
    BotStateMachine.getStatusDescription(bot.status), []);

  // Validation method
  const validateTransition = useCallback(async (bot: Bot, action: string) => {
    try {
      const result = await BotStateMachine.requestTransition(bot, action, getUserId());
      return {
        isValid: result.success,
        errors: result.errors || [],
        warnings: result.warnings
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
        warnings: []
      };
    }
  }, [getUserId]);

  const value: BotStateMachineContextType = {
    // State
    isTransitioning,
    lastTransition,
    
    // Core methods
    transitionBot,
    
    // Convenience methods
    startBot,
    pauseBot,
    stopBot,
    resumeBot,
    resetBot,
    abandonBot,
    reactivateBot,
    errorBot,
    
    // Query methods
    getAvailableActions,
    getRecommendedActions,
    isActionAvailable,
    getStatusDescription,
    
    // Validation
    validateTransition
  };

  return (
    <BotStateMachineContext.Provider value={value}>
      {children}
    </BotStateMachineContext.Provider>
  );
}

export function useBotStateMachine() {
  const context = useContext(BotStateMachineContext);
  if (context === undefined) {
    throw new Error('useBotStateMachine must be used within a BotStateMachineProvider');
  }
  return context;
}