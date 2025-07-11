import { useEffect,useState } from 'react';

import { BotStateMachine } from '@/lib/services/bots/bot-state-machine';
import { Bot } from '@/schemas/bot.schema';

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

/**
 * Hook to provide bot state validation and action availability
 */
export function useBotStateValidation(bot: Bot | null): ValidationState {
  const [validation, setValidation] = useState<ValidationState>({
    canStart: false,
    canPause: false,
    canStop: false,
    canReset: false,
    canReactivate: false,
    availableActions: [],
    recommendedActions: [],
    statusDescription: '',
    validationErrors: {}
  });

  useEffect(() => {
    if (!bot) {
      setValidation({
        canStart: false,
        canPause: false,
        canStop: false,
        canReset: false,
        canReactivate: false,
        availableActions: [],
        recommendedActions: [],
        statusDescription: '',
        validationErrors: {}
      });
      return;
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

    // Validate common actions to get error messages
    const validationErrors: Record<string, string[]> = {};
    
    // Validate start action
    if (availableActions.includes('start')) {
      BotStateMachine.requestTransition(bot, 'start', 'validation-check')
        .then(result => {
          if (!result.success && result.errors) {
            validationErrors.start = result.errors;
          }
        })
        .catch(() => {
          // Ignore validation errors for UI purposes
        });
    }

    setValidation({
      canStart,
      canPause,
      canStop,
      canReset,
      canReactivate,
      availableActions,
      recommendedActions,
      statusDescription,
      validationErrors
    });

  }, [bot]);

  return validation;
}

/**
 * Helper function to get user-friendly action names
 */
export function getActionDisplayName(action: string): string {
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
}

/**
 * Helper function to get action button styling based on action type
 */
export function getActionButtonClass(action: string): string {
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
}

/**
 * Helper function to get status-specific UI recommendations
 */
export function getStatusRecommendations(bot: Bot): {
  message: string;
  actions: string[];
  severity: 'info' | 'warning' | 'error';
} {
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
}