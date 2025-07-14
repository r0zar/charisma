'use client';

import { useUser } from '@clerk/nextjs';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo,useState } from 'react';

import { BotStateMachine,ValidationResult } from '@/lib/services/bots/core/bot-state-machine';
import { Bot, BotStats, CreateBotRequest } from '@/schemas/bot.schema';

import { useToast } from './toast-context';

// ==================== CONSOLIDATED INTERFACES ====================

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

interface ValidationState {
  canStart: boolean;
  canPause: boolean;
  canStop: boolean;
  canReset: boolean;
  canReactivate: boolean;
  availableActions: string[];
  recommendedActions: string[];
  statusDescription: string;
  validationErrors: Record<string, string[]>;
}

interface StatusRecommendations {
  message: string;
  actions: string[];
  severity: 'info' | 'warning' | 'error';
}

// ==================== MAIN INTERFACE ====================

interface BotContextType {
  // ==================== GLOBAL BOT DATA ====================
  bots: Bot[];                    // User's bots
  allBots: Bot[];                 // All bots (SSR data)
  botStats: BotStats;             // User's bot statistics
  loading: boolean;               // Global loading state
  error: string | null;           // Global error state

  // ==================== CURRENT BOT ====================
  currentBot: Bot | null;         // Currently selected bot
  currentBotLoading: boolean;     // Current bot loading state
  isOwnBot: boolean;             // Whether user owns current bot
  setCurrentBot: (botId: string | null) => void;    // Set current bot by ID

  // ==================== CRUD OPERATIONS ====================
  createBot: (request: CreateBotRequest) => Promise<Bot>;
  updateBot: (id: string, updates: Partial<Bot>) => Promise<Bot>;
  deleteBot: (id: string) => Promise<void>;
  getBot: (id: string) => Bot | undefined;
  refreshData: () => Promise<void>;
  updateBotInContext: (botId: string, updates: Partial<Bot>) => void;

  // ==================== STATE TRANSITIONS ====================
  isTransitioning: boolean;
  lastTransition: StateMachineTransition | null;
  transitionBot: (bot: Bot, action: string, reason?: string) => Promise<Bot | null>;

  // Convenience transition methods
  startBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  pauseBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  stopBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  resumeBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  resetBot: (bot: Bot, reason?: string) => Promise<Bot | null>;
  reactivateBot: (bot: Bot, reason?: string) => Promise<Bot | null>;

  // ==================== STATE VALIDATION ====================
  getValidationState: (bot: Bot | null) => ValidationState;
  validateTransition: (bot: Bot, action: string) => Promise<ValidationResult>;
  getAvailableActions: (bot: Bot) => string[];
  getRecommendedActions: (bot: Bot) => string[];
  isActionAvailable: (bot: Bot, action: string) => boolean;
  getStatusDescription: (bot: Bot) => string;

  // ==================== UI HELPERS ====================
  getActionDisplayName: (action: string) => string;
  getActionButtonClass: (action: string) => string;
  getStatusRecommendations: (bot: Bot) => StatusRecommendations;
}

const BotContext = createContext<BotContextType | undefined>(undefined);

export const useBots = () => {
  const context = useContext(BotContext);
  if (!context) {
    throw new Error('useBots must be used within a BotProvider');
  }
  return context;
};

interface BotProviderProps {
  children: ReactNode;
  initialBots?: Bot[];
  currentBotId?: string;  // NEW: For setting current bot
  onCurrentBotChange?: (bot: Bot | null) => void;  // NEW: Callback
}

export function BotProvider({
  children,
  initialBots = [],
  currentBotId,
  onCurrentBotChange
}: BotProviderProps) {
  const { showSuccess, showError, showWarning } = useToast();
  const { user, isSignedIn } = useUser();

  // ==================== STATE ====================
  const [allBots, setAllBots] = useState<Bot[]>(initialBots);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current bot state
  const [currentBot, setCurrentBotState] = useState<Bot | null>(null);
  const [currentBotLoading, setCurrentBotLoading] = useState(false);

  // State transition state
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [lastTransition, setLastTransition] = useState<StateMachineTransition | null>(null);

  // ==================== DERIVED STATE ====================

  // Derive filtered bots based on Clerk authentication
  const bots = isSignedIn && user?.id
    ? allBots.filter(bot => bot.ownerId === user.id)
    : [];

  // Derive stats from filtered bots
  const botStats: BotStats = {
    totalBots: bots.length,
    activeBots: bots.filter(bot => bot.status === 'active').length,
    pausedBots: bots.filter(bot => bot.status === 'paused').length,
    errorBots: bots.filter(bot => bot.status === 'error').length,
  };

  // Derive ownership of current bot
  const isOwnBot = useMemo(() => {
    if (!currentBot || !user?.id) return false;
    return currentBot.ownerId === user.id;
  }, [currentBot, user?.id]);

  // ==================== CURRENT BOT MANAGEMENT ====================

  // Function to set current bot by ID
  const setCurrentBot = useCallback(async (botId: string | null) => {
    if (!botId) {
      setCurrentBotState(null);
      onCurrentBotChange?.(null);
      return;
    }

    setCurrentBotLoading(true);
    try {
      // Always fetch the bot with full execution metadata from the API
      const response = await fetch(`/api/v1/bots/${botId}`);
      if (response.ok) {
        const responseData = await response.json();
        const botData = responseData.bot; // Extract bot from API response structure
        setCurrentBotState(botData);
        onCurrentBotChange?.(botData);
      } else {
        // If API fetch fails, fall back to local state
        const localBot = allBots.find(bot => bot.id === botId);
        if (localBot) {
          setCurrentBotState(localBot);
          onCurrentBotChange?.(localBot);
        } else {
          setCurrentBotState(null);
          onCurrentBotChange?.(null);
        }
      }
    } catch (error) {
      console.error('Failed to set current bot:', error);
      // Fall back to local state on error
      const localBot = allBots.find(bot => bot.id === botId);
      if (localBot) {
        setCurrentBotState(localBot);
        onCurrentBotChange?.(localBot);
      } else {
        setCurrentBotState(null);
        onCurrentBotChange?.(null);
      }
    } finally {
      setCurrentBotLoading(false);
    }
  }, [allBots, onCurrentBotChange]);

  // Auto-set current bot when currentBotId prop changes
  useEffect(() => {
    if (currentBotId) {
      setCurrentBot(currentBotId);
    }
  }, [currentBotId, setCurrentBot]);

  // Auto-sync current bot when allBots changes
  useEffect(() => {
    if (currentBot) {
      const updatedBot = allBots.find(bot => bot.id === currentBot.id);
      if (updatedBot && updatedBot !== currentBot) {
        setCurrentBotState(updatedBot);
        onCurrentBotChange?.(updatedBot);
      }
    }
  }, [allBots, currentBot, onCurrentBotChange]);

  // ==================== CRUD OPERATIONS ====================

  const createBot = async (request: CreateBotRequest): Promise<Bot> => {
    // Require Clerk authentication for bot creation
    if (!isSignedIn || !user?.id) {
      throw new Error('You must be signed in to create a bot');
    }

    // Check for alpha access via URL fragment
    const hasAlphaAccess = typeof window !== 'undefined' && window.location.hash === '#alpha';
    if (!hasAlphaAccess) {
      throw new Error('Bot creation is currently in alpha. Add #alpha to the URL for access.');
    }

    try {
      setLoading(true);

      // Create bot via API using Clerk userId, include alpha access
      const response = await fetch(`/api/v1/bots?userId=${user.id}&alpha=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-alpha-access': 'true',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create bot');
      }

      const data = await response.json();
      const newBot = data.bot;

      // Update local state
      setAllBots(prev => [newBot, ...prev]);

      showSuccess('Bot created successfully');
      return newBot;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create bot';
      showError('Failed to create bot', errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateBot = async (id: string, updates: Partial<Bot>): Promise<Bot> => {
    // Require Clerk authentication
    if (!isSignedIn || !user?.id) {
      throw new Error('You must be signed in to update bots');
    }

    setLoading(true);
    try {
      const existingBot = bots.find(bot => bot.id === id);
      if (!existingBot) {
        throw new Error('Bot not found');
      }

      // Verify ownership using ownerId
      if (existingBot.ownerId !== user.id) {
        throw new Error('You can only update bots you own');
      }

      const updatedBot = { ...existingBot, ...updates };

      // Update bot via API using Clerk userId
      const response = await fetch(`/api/v1/bots?userId=${user.id}&botId=${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedBot),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update bot');
      }

      const data = await response.json();
      const apiUpdatedBot = data.bot;

      // Update local state
      setAllBots(prev => prev.map(bot => bot.id === id ? apiUpdatedBot : bot));

      return apiUpdatedBot;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update bot';
      showError('Failed to update bot', errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const deleteBot = async (id: string): Promise<void> => {
    // Require Clerk authentication
    if (!isSignedIn || !user?.id) {
      throw new Error('You must be signed in to delete bots');
    }

    try {
      setLoading(true);

      const existingBot = bots.find(bot => bot.id === id);
      if (!existingBot) {
        throw new Error('Bot not found');
      }

      // Verify ownership using ownerId
      if (existingBot.ownerId !== user.id) {
        throw new Error('You can only delete bots you own');
      }

      // Delete bot via API using Clerk userId
      const response = await fetch(`/api/v1/bots?userId=${user.id}&botId=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete bot');
      }

      // Update local state
      setAllBots(prev => prev.filter(bot => bot.id !== id));

      showSuccess('Bot deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete bot';
      showError('Failed to delete bot', errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getBot = (id: string): Bot | undefined => {
    return bots.find(bot => bot.id === id);
  };

  const refreshData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // Always fetch all bots - frontend filtering handles user-specific display
      const response = await fetch('/api/v1/bots');

      if (!response.ok) {
        throw new Error('Failed to refresh data');
      }

      const data = await response.json();

      // Update state with fresh data
      setAllBots(data.list || []);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies needed - always calls same public API

  const updateBotInContext = (botId: string, updates: Partial<Bot>) => {
    setAllBots(prev => prev.map(bot =>
      bot.id === botId ? { ...bot, ...updates } : bot
    ));
  };

  // ==================== STATE TRANSITIONS ====================

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
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/v1/bots/${bot.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          reason
        })
      });

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
  }, [isTransitioning, user?.id, showSuccess, showError, showWarning, refreshData]);

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

  const reactivateBot = useCallback((bot: Bot, reason?: string) =>
    transitionBot(bot, 'reactivate', reason), [transitionBot]);

  // ==================== STATE VALIDATION ====================

  const getValidationState = useCallback((bot: Bot | null): ValidationState => {
    if (!bot) {
      return {
        canStart: false,
        canPause: false,
        canStop: false,
        canReset: false,
        canReactivate: false,
        availableActions: [],
        recommendedActions: [],
        statusDescription: '',
        validationErrors: {}
      };
    }

    // Get available and recommended actions from state machine
    const availableActions = BotStateMachine.getAvailableActions(bot);
    const recommendedActions = BotStateMachine.getRecommendedActions(bot);
    const statusDescription = BotStateMachine.getStatusDescription(bot.status);

    // Check specific action availability
    const canStart = BotStateMachine.isActionAvailable(bot, 'start');
    const canPause = BotStateMachine.isActionAvailable(bot, 'pause');
    const canStop = BotStateMachine.isActionAvailable(bot, 'stop');
    const canReset = BotStateMachine.isActionAvailable(bot, 'reset');
    const canReactivate = BotStateMachine.isActionAvailable(bot, 'reactivate');

    // TODO: Add validation errors if needed
    const validationErrors: Record<string, string[]> = {};

    return {
      canStart,
      canPause,
      canStop,
      canReset,
      canReactivate,
      availableActions,
      recommendedActions,
      statusDescription,
      validationErrors
    };
  }, []);

  // Validation method
  const validateTransition = useCallback(async (bot: Bot, action: string): Promise<ValidationResult> => {
    try {
      if (!user?.id) {
        return {
          isValid: false,
          errors: ['User not authenticated']
        };
      }
      const result = await BotStateMachine.requestTransition(bot, action, user.id);
      return {
        isValid: result.success,
        errors: result.errors || [],
        warnings: result.warnings
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed']
      };
    }
  }, [user?.id]);

  // State query methods
  const getAvailableActions = useCallback((bot: Bot) =>
    BotStateMachine.getAvailableActions(bot), []);

  const getRecommendedActions = useCallback((bot: Bot) =>
    BotStateMachine.getRecommendedActions(bot), []);

  const isActionAvailable = useCallback((bot: Bot, action: string) =>
    BotStateMachine.isActionAvailable(bot, action), []);

  const getStatusDescription = useCallback((bot: Bot) =>
    BotStateMachine.getStatusDescription(bot.status), []);

  // ==================== UI HELPERS ====================

  /**
   * Helper function to get user-friendly action names
   */
  const getActionDisplayName = useCallback((action: string): string => {
    const displayNames: Record<string, string> = {
      start: 'Start',
      pause: 'Pause',
      stop: 'Stop',
      resume: 'Resume',
      reset: 'Reset',
      abandon: 'Abandon',
      reactivate: 'Reactivate',
      error: 'Mark as Error'
    };
    return displayNames[action] || action;
  }, []);

  /**
   * Helper function to get action button styling based on action type
   */
  const getActionButtonClass = useCallback((action: string): string => {
    const buttonClasses: Record<string, string> = {
      start: 'border-green-600 text-green-400 hover:bg-green-500/10',
      resume: 'border-green-600 text-green-400 hover:bg-green-500/10',
      pause: 'border-yellow-600 text-yellow-400 hover:bg-yellow-500/10',
      stop: 'border-red-600 text-red-400 hover:bg-red-500/10',
      abandon: 'border-red-600 text-red-400 hover:bg-red-500/10',
      reset: 'border-blue-600 text-blue-400 hover:bg-blue-500/10',
      reactivate: 'border-purple-600 text-purple-400 hover:bg-purple-500/10',
      error: 'border-orange-600 text-orange-400 hover:bg-orange-500/10'
    };
    return buttonClasses[action] || 'border-gray-600 text-gray-400 hover:bg-gray-500/10';
  }, []);

  /**
   * Helper function to get status-specific UI recommendations
   */
  const getStatusRecommendations = useCallback((bot: Bot): StatusRecommendations => {
    switch (bot.status) {
      case 'setup':
        return {
          message: 'Bot needs configuration before it can start trading',
          actions: ['Configure strategy', 'Fund wallet', 'Start bot'],
          severity: 'info'
        };

      case 'active':
        return {
          message: 'Bot is actively executing trades',
          actions: ['Monitor performance', 'Pause if needed'],
          severity: 'info'
        };

      case 'paused':
        return {
          message: 'Bot is temporarily stopped',
          actions: ['Resume trading', 'Review strategy', 'Stop permanently'],
          severity: 'warning'
        };

      case 'error':
        return {
          message: 'Bot encountered an error and needs attention',
          actions: ['Check logs', 'Reset configuration', 'Contact support'],
          severity: 'error'
        };

      case 'inactive':
        return {
          message: 'Bot is stopped and requires reactivation',
          actions: ['Reactivate bot', 'Review configuration'],
          severity: 'warning'
        };

      default:
        return {
          message: 'Unknown bot status',
          actions: [],
          severity: 'error'
        };
    }
  }, []);

  // ==================== PROVIDER VALUE ====================

  const value: BotContextType = {
    // Global bot data
    bots,
    allBots,
    botStats,
    loading,
    error,

    // Current bot
    currentBot,
    currentBotLoading,
    isOwnBot,
    setCurrentBot,

    // CRUD operations
    createBot,
    updateBot,
    deleteBot,
    getBot,
    refreshData,
    updateBotInContext,

    // State transitions
    isTransitioning,
    lastTransition,
    transitionBot,
    startBot,
    pauseBot,
    stopBot,
    resumeBot,
    resetBot,
    reactivateBot,

    // State validation
    getValidationState,
    validateTransition,
    getAvailableActions,
    getRecommendedActions,
    isActionAvailable,
    getStatusDescription,

    // UI helpers
    getActionDisplayName,
    getActionButtonClass,
    getStatusRecommendations
  };

  return <BotContext.Provider value={value}>{children}</BotContext.Provider>;
};