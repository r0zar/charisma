/**
 * Bot State Machine
 * Defines valid state transitions and business rules for bot lifecycle management
 */

import { Bot } from '@/schemas/bot.schema';

export type BotStatus = Bot['status'];

export interface StateTransition {
  from: BotStatus;
  to: BotStatus;
  action: string;
  requiresValidation?: boolean;
  conditions?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface TransitionRequest {
  botId: string;
  action: string;
  fromStatus: BotStatus;
  toStatus: BotStatus;
  userId: string;
  reason?: string;
}

export interface TransitionResult {
  success: boolean;
  fromStatus: BotStatus;
  toStatus: BotStatus;
  errors?: string[];
  warnings?: string[];
  timestamp: string;
  transitionId: string;
}

/**
 * Valid state transitions with their required actions and conditions
 */
export const STATE_TRANSITIONS: StateTransition[] = [
  // From setup state
  {
    from: 'setup',
    to: 'active',
    action: 'start',
    requiresValidation: true,
    conditions: ['hasWallet', 'hasValidStrategy', 'hasMinimumBalance']
  },
  {
    from: 'setup',
    to: 'inactive',
    action: 'abandon',
    requiresValidation: false
  },

  // From active state
  {
    from: 'active',
    to: 'paused',
    action: 'pause',
    requiresValidation: false
  },
  {
    from: 'active',
    to: 'error',
    action: 'error',
    requiresValidation: false
  },
  {
    from: 'active',
    to: 'inactive',
    action: 'stop',
    requiresValidation: false
  },

  // From paused state
  {
    from: 'paused',
    to: 'active',
    action: 'resume',
    requiresValidation: true,
    conditions: ['hasMinimumBalance']
  },
  {
    from: 'paused',
    to: 'inactive',
    action: 'stop',
    requiresValidation: false
  },
  {
    from: 'paused',
    to: 'error',
    action: 'error',
    requiresValidation: false
  },

  // From error state
  {
    from: 'error',
    to: 'setup',
    action: 'reset',
    requiresValidation: false
  },
  {
    from: 'error',
    to: 'inactive',
    action: 'abandon',
    requiresValidation: false
  },

  // From inactive state
  {
    from: 'inactive',
    to: 'setup',
    action: 'reactivate',
    requiresValidation: false
  }
];

/**
 * Get valid transitions from a given state
 */
export function getValidTransitions(fromStatus: BotStatus): StateTransition[] {
  return STATE_TRANSITIONS.filter(transition => transition.from === fromStatus);
}

/**
 * Check if a transition is valid
 */
export function isValidTransition(fromStatus: BotStatus, toStatus: BotStatus, action: string): boolean {
  return STATE_TRANSITIONS.some(
    transition => 
      transition.from === fromStatus && 
      transition.to === toStatus && 
      transition.action === action
  );
}

/**
 * Get transition by action
 */
export function getTransitionByAction(fromStatus: BotStatus, action: string): StateTransition | undefined {
  return STATE_TRANSITIONS.find(
    transition => transition.from === fromStatus && transition.action === action
  );
}

/**
 * Validate bot for state transition
 */
export async function validateBotForTransition(
  bot: Bot, 
  transition: StateTransition
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!transition.requiresValidation) {
    return { isValid: true, errors: [] };
  }

  // Check required conditions
  if (transition.conditions) {
    for (const condition of transition.conditions) {
      switch (condition) {
        case 'hasWallet':
          if (!bot.encryptedWallet || !bot.walletIv) {
            errors.push('Bot does not have a configured wallet');
          }
          break;

        case 'hasValidStrategy':
          if (!bot.strategy || bot.strategy.trim().length === 0) {
            errors.push('Bot does not have a valid strategy configured');
          }
          // Basic strategy validation
          if (bot.strategy && !bot.strategy.includes('bot.')) {
            warnings?.push('Strategy may not use bot context properly');
          }
          break;

        case 'hasMinimumBalance':
          // Note: We can't check actual wallet balance here without decrypting
          // This would be checked at execution time or via wallet service
          if (transition.to === 'active') {
            warnings?.push('Ensure bot wallet has sufficient STX balance for trading');
          }
          break;

        default:
          warnings?.push(`Unknown validation condition: ${condition}`);
      }
    }
  }

  // Additional business rule validations
  if (transition.to === 'active') {
    // Check if bot has required fields for execution
    if (!bot.ownerId) {
      errors.push('Bot must have an owner to become active');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * State machine class for managing bot transitions
 */
export class BotStateMachine {
  /**
   * Request a state transition
   */
  static async requestTransition(
    bot: Bot,
    action: string,
    _userId: string,
    _reason?: string
  ): Promise<TransitionResult> {
    const transitionId = `transition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Find the transition
    const transition = getTransitionByAction(bot.status, action);
    
    if (!transition) {
      return {
        success: false,
        fromStatus: bot.status,
        toStatus: bot.status,
        errors: [`Invalid action '${action}' for bot in '${bot.status}' state`],
        timestamp,
        transitionId
      };
    }

    // Validate the transition
    const validation = await validateBotForTransition(bot, transition);
    
    if (!validation.isValid) {
      return {
        success: false,
        fromStatus: bot.status,
        toStatus: transition.to,
        errors: validation.errors,
        warnings: validation.warnings,
        timestamp,
        transitionId
      };
    }

    return {
      success: true,
      fromStatus: bot.status,
      toStatus: transition.to,
      warnings: validation.warnings,
      timestamp,
      transitionId
    };
  }

  /**
   * Get available actions for a bot's current state
   */
  static getAvailableActions(bot: Bot): string[] {
    const transitions = getValidTransitions(bot.status);
    return transitions.map(t => t.action);
  }

  /**
   * Check if an action is available for a bot
   */
  static isActionAvailable(bot: Bot, action: string): boolean {
    return this.getAvailableActions(bot).includes(action);
  }

  /**
   * Get human-readable state description
   */
  static getStatusDescription(status: BotStatus): string {
    const descriptions = {
      setup: 'Being configured - not ready to trade',
      active: 'Running and executing trades',
      paused: 'Temporarily stopped - can be resumed',
      error: 'Encountered an error - needs attention',
      inactive: 'Stopped - requires reactivation'
    };
    return descriptions[status];
  }

  /**
   * Get recommended actions for a bot state
   */
  static getRecommendedActions(bot: Bot): string[] {
    switch (bot.status) {
      case 'setup':
        return ['start']; // Primary action
      case 'active':
        return ['pause', 'stop']; // Both are valid options
      case 'paused':
        return ['resume', 'stop']; // Resume is primary
      case 'error':
        return ['reset', 'abandon']; // Reset is primary
      case 'inactive':
        return ['reactivate']; // Only option
      default:
        return [];
    }
  }
}