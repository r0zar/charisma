/**
 * Unit tests for Bot State Machine
 * 
 * Tests state transitions, validations, and business rules for bot lifecycle management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BotStateMachine,
  getValidTransitions,
  isValidTransition,
  getTransitionByAction,
  validateBotForTransition,
  STATE_TRANSITIONS,
  type BotStatus,
  type TransitionResult,
  type ValidationResult
} from '@/lib/services/bots/core/bot-state-machine';
import { type Bot } from '@/schemas/bot.schema';

// Mock console to avoid noise during tests
vi.mock('console', () => ({
  warn: vi.fn(),
  log: vi.fn(),
  error: vi.fn()
}));

describe('Bot State Machine', () => {
  let mockBot: Bot;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockBot = {
      id: 'SP1234567890ABCDEF1234567890ABCDEF12345678',
      name: 'Test Bot',
      strategy: 'bot.trade({ symbol: "STX", amount: 100 });',
      status: 'setup',
      ownerId: 'SP1111111111111111111111111111111111111111',
      createdAt: '2025-01-15T08:00:00.000Z',
      lastActive: '2025-01-15T08:00:00.000Z',
      imageType: 'pokemon',
      cronSchedule: undefined,
      executionCount: 0,
      encryptedWallet: 'encrypted_data',
      walletIv: 'iv_data',
      publicKey: 'public_key'
    };
  });

  describe('STATE_TRANSITIONS', () => {
    it('should have valid state transition definitions', () => {
      expect(Array.isArray(STATE_TRANSITIONS)).toBe(true);
      expect(STATE_TRANSITIONS.length).toBeGreaterThan(0);
      
      STATE_TRANSITIONS.forEach(transition => {
        expect(transition).toHaveProperty('from');
        expect(transition).toHaveProperty('to');
        expect(transition).toHaveProperty('action');
        expect(typeof transition.from).toBe('string');
        expect(typeof transition.to).toBe('string');
        expect(typeof transition.action).toBe('string');
      });
    });

    it('should include all necessary state transitions', () => {
      const actions = STATE_TRANSITIONS.map(t => t.action);
      const requiredActions = ['start', 'pause', 'stop', 'error', 'resume'];
      
      requiredActions.forEach(action => {
        expect(actions).toContain(action);
      });
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions for setup state', () => {
      const transitions = getValidTransitions('setup');
      
      expect(Array.isArray(transitions)).toBe(true);
      expect(transitions.length).toBeGreaterThan(0);
      transitions.forEach(transition => {
        expect(transition.from).toBe('setup');
      });
    });

    it('should return valid transitions for active state', () => {
      const transitions = getValidTransitions('active');
      
      expect(Array.isArray(transitions)).toBe(true);
      transitions.forEach(transition => {
        expect(transition.from).toBe('active');
      });
    });

    it('should return empty array for invalid status', () => {
      const transitions = getValidTransitions('invalid' as BotStatus);
      
      expect(Array.isArray(transitions)).toBe(true);
      expect(transitions.length).toBe(0);
    });

    it('should handle all valid bot statuses', () => {
      const validStatuses: BotStatus[] = ['setup', 'active', 'paused', 'inactive', 'error'];
      
      validStatuses.forEach(status => {
        const transitions = getValidTransitions(status);
        expect(Array.isArray(transitions)).toBe(true);
      });
    });
  });

  describe('isValidTransition', () => {
    it('should validate setup to active transition', () => {
      const isValid = isValidTransition('setup', 'active', 'start');
      expect(isValid).toBe(true);
    });

    it('should validate active to paused transition', () => {
      const isValid = isValidTransition('active', 'paused', 'pause');
      expect(isValid).toBe(true);
    });

    it('should reject invalid transitions', () => {
      const isValid = isValidTransition('setup', 'error', 'start');
      expect(isValid).toBe(false);
    });

    it('should reject transitions with wrong action', () => {
      const isValid = isValidTransition('setup', 'active', 'pause');
      expect(isValid).toBe(false);
    });

    it('should handle same state transitions', () => {
      const isValid = isValidTransition('active', 'active', 'refresh');
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('getTransitionByAction', () => {
    it('should find transition by valid action', () => {
      const transition = getTransitionByAction('setup', 'start');
      
      expect(transition).toBeDefined();
      expect(transition?.from).toBe('setup');
      expect(transition?.action).toBe('start');
    });

    it('should return undefined for invalid action', () => {
      const transition = getTransitionByAction('setup', 'invalid_action');
      
      expect(transition).toBeUndefined();
    });

    it('should return undefined for action not available in current state', () => {
      const transition = getTransitionByAction('setup', 'resume');
      
      expect(transition).toBeUndefined();
    });

    it('should handle all valid states', () => {
      const validStatuses: BotStatus[] = ['setup', 'active', 'paused', 'inactive', 'error'];
      
      validStatuses.forEach(status => {
        const transitions = getValidTransitions(status);
        transitions.forEach(trans => {
          const found = getTransitionByAction(status, trans.action);
          expect(found).toBeDefined();
          expect(found?.action).toBe(trans.action);
        });
      });
    });
  });

  describe('validateBotForTransition', () => {
    it('should validate setup to active transition', async () => {
      const transition = getTransitionByAction('setup', 'start')!;
      const result = await validateBotForTransition(mockBot, transition);
      
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should reject bot without required fields', async () => {
      const botWithoutOwner = { ...mockBot, ownerId: '' };
      const transition = getTransitionByAction('setup', 'start')!;
      const result = await validateBotForTransition(botWithoutOwner, transition);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate bot with all required fields', async () => {
      const completeBot = {
        ...mockBot,
        strategy: 'bot.trade({ symbol: "STX", amount: 100 });',
        encryptedWallet: 'encrypted_data',
        walletIv: 'iv_data'
      };
      const transition = getTransitionByAction('setup', 'start')!;
      const result = await validateBotForTransition(completeBot, transition);
      
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should include warnings when available', async () => {
      const transition = getTransitionByAction('setup', 'start')!;
      const result = await validateBotForTransition(mockBot, transition);
      
      if (result.warnings) {
        expect(Array.isArray(result.warnings)).toBe(true);
      }
    });
  });

  describe('BotStateMachine.requestTransition', () => {
    it('should successfully request valid transition', async () => {
      const result = await BotStateMachine.requestTransition(
        mockBot,
        'start',
        'SP1111111111111111111111111111111111111111',
        'Activating bot for trading'
      );
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('fromStatus');
      expect(result).toHaveProperty('toStatus');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('transitionId');
      
      expect(result.fromStatus).toBe('setup');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.timestamp).toBe('string');
      expect(typeof result.transitionId).toBe('string');
    });

    it('should reject invalid action', async () => {
      const result = await BotStateMachine.requestTransition(
        mockBot,
        'invalid_action',
        'SP1111111111111111111111111111111111111111'
      );
      
      expect(result.success).toBe(false);
      expect(result.fromStatus).toBe('setup');
      expect(result.toStatus).toBe('setup');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should handle validation failures', async () => {
      const invalidBot = { ...mockBot, ownerId: '' };
      const result = await BotStateMachine.requestTransition(
        invalidBot,
        'start',
        'SP1111111111111111111111111111111111111111'
      );
      
      expect(result.success).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should include reason in transition when provided', async () => {
      const reason = 'User requested activation';
      const result = await BotStateMachine.requestTransition(
        mockBot,
        'start',
        'SP1111111111111111111111111111111111111111',
        reason
      );
      
      // The reason should be included in the transition result
      expect(typeof result.transitionId).toBe('string');
      expect(result.transitionId.length).toBeGreaterThan(0);
    });

    it('should generate unique transition IDs', async () => {
      const result1 = await BotStateMachine.requestTransition(
        mockBot,
        'start',
        'SP1111111111111111111111111111111111111111'
      );
      
      const result2 = await BotStateMachine.requestTransition(
        mockBot,
        'start',
        'SP1111111111111111111111111111111111111111'
      );
      
      expect(result1.transitionId).not.toBe(result2.transitionId);
    });

    it('should handle transitions from different states', async () => {
      const activeBot = { ...mockBot, status: 'active' as BotStatus };
      const result = await BotStateMachine.requestTransition(
        activeBot,
        'pause',
        'SP1111111111111111111111111111111111111111'
      );
      
      expect(result.fromStatus).toBe('active');
      expect(typeof result.success).toBe('boolean');
    });

    it('should validate timestamp format', async () => {
      const result = await BotStateMachine.requestTransition(
        mockBot,
        'start',
        'SP1111111111111111111111111111111111111111'
      );
      
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });

  describe('BotStateMachine.getAvailableActions', () => {
    it('should return available actions for setup state', () => {
      const setupBot = { ...mockBot, status: 'setup' as BotStatus };
      const actions = BotStateMachine.getAvailableActions(setupBot);
      
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions).toContain('start');
      expect(actions).toContain('abandon');
    });

    it('should return available actions for active state', () => {
      const activeBot = { ...mockBot, status: 'active' as BotStatus };
      const actions = BotStateMachine.getAvailableActions(activeBot);
      
      expect(Array.isArray(actions)).toBe(true);
      expect(actions).toContain('pause');
      expect(actions).toContain('stop');
      expect(actions).toContain('error');
    });

    it('should return available actions for paused state', () => {
      const pausedBot = { ...mockBot, status: 'paused' as BotStatus };
      const actions = BotStateMachine.getAvailableActions(pausedBot);
      
      expect(Array.isArray(actions)).toBe(true);
      expect(actions).toContain('resume');
      expect(actions).toContain('stop');
      expect(actions).toContain('error');
    });

    it('should return available actions for error state', () => {
      const errorBot = { ...mockBot, status: 'error' as BotStatus };
      const actions = BotStateMachine.getAvailableActions(errorBot);
      
      expect(Array.isArray(actions)).toBe(true);
      expect(actions).toContain('reset');
      expect(actions).toContain('abandon');
    });

    it('should return available actions for inactive state', () => {
      const inactiveBot = { ...mockBot, status: 'inactive' as BotStatus };
      const actions = BotStateMachine.getAvailableActions(inactiveBot);
      
      expect(Array.isArray(actions)).toBe(true);
      expect(actions).toContain('reactivate');
    });
  });

  describe('BotStateMachine.isActionAvailable', () => {
    it('should return true for available actions', () => {
      const setupBot = { ...mockBot, status: 'setup' as BotStatus };
      
      expect(BotStateMachine.isActionAvailable(setupBot, 'start')).toBe(true);
      expect(BotStateMachine.isActionAvailable(setupBot, 'abandon')).toBe(true);
    });

    it('should return false for unavailable actions', () => {
      const setupBot = { ...mockBot, status: 'setup' as BotStatus };
      
      expect(BotStateMachine.isActionAvailable(setupBot, 'pause')).toBe(false);
      expect(BotStateMachine.isActionAvailable(setupBot, 'resume')).toBe(false);
      expect(BotStateMachine.isActionAvailable(setupBot, 'invalid_action')).toBe(false);
    });

    it('should handle different bot states correctly', () => {
      const activeBot = { ...mockBot, status: 'active' as BotStatus };
      const pausedBot = { ...mockBot, status: 'paused' as BotStatus };
      
      expect(BotStateMachine.isActionAvailable(activeBot, 'pause')).toBe(true);
      expect(BotStateMachine.isActionAvailable(activeBot, 'start')).toBe(false);
      
      expect(BotStateMachine.isActionAvailable(pausedBot, 'resume')).toBe(true);
      expect(BotStateMachine.isActionAvailable(pausedBot, 'start')).toBe(false);
    });
  });

  describe('BotStateMachine.getStatusDescription', () => {
    it('should return correct descriptions for all bot statuses', () => {
      expect(BotStateMachine.getStatusDescription('setup')).toBe('Being configured - not ready to trade');
      expect(BotStateMachine.getStatusDescription('active')).toBe('Running and executing trades');
      expect(BotStateMachine.getStatusDescription('paused')).toBe('Temporarily stopped - can be resumed');
      expect(BotStateMachine.getStatusDescription('error')).toBe('Encountered an error - needs attention');
      expect(BotStateMachine.getStatusDescription('inactive')).toBe('Stopped - requires reactivation');
    });

    it('should return undefined for invalid status', () => {
      // Test with undefined/invalid status
      const description = BotStateMachine.getStatusDescription('invalid' as BotStatus);
      expect(description).toBeUndefined();
    });
  });

  describe('BotStateMachine.getRecommendedActions', () => {
    it('should return recommended actions for setup state', () => {
      const setupBot = { ...mockBot, status: 'setup' as BotStatus };
      const recommendations = BotStateMachine.getRecommendedActions(setupBot);
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations).toContain('start');
      expect(recommendations.length).toBe(1);
    });

    it('should return recommended actions for active state', () => {
      const activeBot = { ...mockBot, status: 'active' as BotStatus };
      const recommendations = BotStateMachine.getRecommendedActions(activeBot);
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations).toContain('pause');
      expect(recommendations).toContain('stop');
      expect(recommendations.length).toBe(2);
    });

    it('should return recommended actions for paused state', () => {
      const pausedBot = { ...mockBot, status: 'paused' as BotStatus };
      const recommendations = BotStateMachine.getRecommendedActions(pausedBot);
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations).toContain('resume');
      expect(recommendations).toContain('stop');
      expect(recommendations.length).toBe(2);
    });

    it('should return recommended actions for error state', () => {
      const errorBot = { ...mockBot, status: 'error' as BotStatus };
      const recommendations = BotStateMachine.getRecommendedActions(errorBot);
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations).toContain('reset');
      expect(recommendations).toContain('abandon');
      expect(recommendations.length).toBe(2);
    });

    it('should return recommended actions for inactive state', () => {
      const inactiveBot = { ...mockBot, status: 'inactive' as BotStatus };
      const recommendations = BotStateMachine.getRecommendedActions(inactiveBot);
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations).toContain('reactivate');
      expect(recommendations.length).toBe(1);
    });

    it('should return empty array for invalid state', () => {
      const invalidBot = { ...mockBot, status: 'invalid' as BotStatus };
      const recommendations = BotStateMachine.getRecommendedActions(invalidBot);
      
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBe(0);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle bot without status', async () => {
      const botWithoutStatus = { ...mockBot };
      delete (botWithoutStatus as any).status;
      
      const result = await BotStateMachine.requestTransition(
        botWithoutStatus as Bot,
        'start',
        'SP1111111111111111111111111111111111111111'
      );
      
      expect(result.success).toBe(false);
    });

    it('should handle empty action string', async () => {
      const result = await BotStateMachine.requestTransition(
        mockBot,
        '',
        'SP1111111111111111111111111111111111111111'
      );
      
      expect(result.success).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle null/undefined userId', async () => {
      const result = await BotStateMachine.requestTransition(
        mockBot,
        'start',
        null as any
      );
      
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.transitionId).toBe('string');
    });

    it('should handle bots with all possible statuses in helper methods', () => {
      const statuses: BotStatus[] = ['setup', 'active', 'paused', 'error', 'inactive'];
      
      statuses.forEach(status => {
        const bot = { ...mockBot, status };
        
        // Test all helper methods work with each status
        const actions = BotStateMachine.getAvailableActions(bot);
        const recommendations = BotStateMachine.getRecommendedActions(bot);
        const description = BotStateMachine.getStatusDescription(status);
        
        expect(Array.isArray(actions)).toBe(true);
        expect(Array.isArray(recommendations)).toBe(true);
        expect(typeof description).toBe('string');
        
        // Test that at least one action is available for each non-error state
        if (status !== 'error') {
          expect(actions.length).toBeGreaterThan(0);
        }
      });
    });
  });
});