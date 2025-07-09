import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  isTransactionFinal,
  isTransactionSuccessful,
  isTransactionFailed,
  isTransactionPending,
  getStatusPriority,
  formatTransactionAge,
  validateTransactionId,
  normalizeTransactionId,
  TransactionStatusTracker
} from '../utils';

describe('Transaction Status Utils', () => {
  describe('isTransactionFinal', () => {
    it('should return true for final statuses', () => {
      expect(isTransactionFinal('success')).toBe(true);
      expect(isTransactionFinal('abort_by_response')).toBe(true);
      expect(isTransactionFinal('abort_by_post_condition')).toBe(true);
      expect(isTransactionFinal('not_found')).toBe(true);
    });

    it('should return false for non-final statuses', () => {
      expect(isTransactionFinal('pending')).toBe(false);
      expect(isTransactionFinal('broadcasted')).toBe(false);
    });
  });

  describe('isTransactionSuccessful', () => {
    it('should return true only for success status', () => {
      expect(isTransactionSuccessful('success')).toBe(true);
      expect(isTransactionSuccessful('abort_by_response')).toBe(false);
      expect(isTransactionSuccessful('pending')).toBe(false);
    });
  });

  describe('isTransactionFailed', () => {
    it('should return true for failed statuses', () => {
      expect(isTransactionFailed('abort_by_response')).toBe(true);
      expect(isTransactionFailed('abort_by_post_condition')).toBe(true);
      expect(isTransactionFailed('not_found')).toBe(true);
    });

    it('should return false for non-failed statuses', () => {
      expect(isTransactionFailed('success')).toBe(false);
      expect(isTransactionFailed('pending')).toBe(false);
      expect(isTransactionFailed('broadcasted')).toBe(false);
    });
  });

  describe('isTransactionPending', () => {
    it('should return true for pending statuses', () => {
      expect(isTransactionPending('pending')).toBe(true);
      expect(isTransactionPending('broadcasted')).toBe(true);
    });

    it('should return false for non-pending statuses', () => {
      expect(isTransactionPending('success')).toBe(false);
      expect(isTransactionPending('abort_by_response')).toBe(false);
      expect(isTransactionPending('not_found')).toBe(false);
    });
  });

  describe('getStatusPriority', () => {
    it('should return correct priorities', () => {
      expect(getStatusPriority('success')).toBe(0);
      expect(getStatusPriority('abort_by_response')).toBe(1);
      expect(getStatusPriority('abort_by_post_condition')).toBe(2);
      expect(getStatusPriority('not_found')).toBe(3);
      expect(getStatusPriority('pending')).toBe(4);
      expect(getStatusPriority('broadcasted')).toBe(5);
    });
  });

  describe('formatTransactionAge', () => {
    it('should format age correctly', () => {
      const now = Date.now();
      
      expect(formatTransactionAge(now - 30000)).toBe('30s ago');
      expect(formatTransactionAge(now - 120000)).toBe('2m 0s ago');
      expect(formatTransactionAge(now - 3600000)).toBe('1h 0m ago');
      expect(formatTransactionAge(now - 86400000)).toBe('1d 0h ago');
    });
  });

  describe('validateTransactionId', () => {
    it('should validate correct transaction IDs', () => {
      expect(validateTransactionId('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')).toBe(true);
      expect(validateTransactionId('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')).toBe(true);
    });

    it('should reject invalid transaction IDs', () => {
      expect(validateTransactionId('')).toBe(false);
      expect(validateTransactionId('short')).toBe(false);
      expect(validateTransactionId('0x123')).toBe(false);
      expect(validateTransactionId('0xinvalid')).toBe(false);
      expect(validateTransactionId('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefgg')).toBe(false);
    });
  });

  describe('normalizeTransactionId', () => {
    it('should normalize transaction IDs', () => {
      expect(normalizeTransactionId('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'))
        .toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
      
      expect(normalizeTransactionId('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'))
        .toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
    });

    it('should throw for invalid input', () => {
      expect(() => normalizeTransactionId('')).toThrow('Invalid transaction ID');
      expect(() => normalizeTransactionId(null as any)).toThrow('Invalid transaction ID');
    });
  });
});

describe('TransactionStatusTracker', () => {
  let tracker: TransactionStatusTracker;

  beforeEach(() => {
    tracker = new TransactionStatusTracker();
  });

  describe('addStatus', () => {
    it('should add status to history', () => {
      tracker.addStatus('pending');
      tracker.addStatus('success');

      const history = tracker.getStatusHistory();
      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('pending');
      expect(history[1].status).toBe('success');
    });

    it('should trigger callbacks on status change', () => {
      let callbackCalled = false;
      let lastStatus: any;
      let previousStatus: any;

      tracker.onStatusChange((status, previous) => {
        callbackCalled = true;
        lastStatus = status;
        previousStatus = previous;
      });

      tracker.addStatus('pending');
      tracker.addStatus('success');

      expect(callbackCalled).toBe(true);
      expect(lastStatus).toBe('success');
      expect(previousStatus).toBe('pending');
    });

    it('should not trigger callbacks for same status', () => {
      let callbackCount = 0;

      tracker.onStatusChange(() => {
        callbackCount++;
      });

      tracker.addStatus('pending');
      tracker.addStatus('pending');

      expect(callbackCount).toBe(1);
    });
  });

  describe('getCurrentStatus', () => {
    it('should return current status', () => {
      expect(tracker.getCurrentStatus()).toBeUndefined();
      
      tracker.addStatus('pending');
      expect(tracker.getCurrentStatus()).toBe('pending');
      
      tracker.addStatus('success');
      expect(tracker.getCurrentStatus()).toBe('success');
    });
  });

  describe('getDuration', () => {
    it('should calculate total duration', async () => {
      const start = Date.now();
      tracker.addStatus('pending');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      tracker.addStatus('success');
      const duration = tracker.getDuration();
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear history and callbacks', () => {
      tracker.addStatus('pending');
      tracker.onStatusChange(() => {});
      
      tracker.clear();
      
      expect(tracker.getStatusHistory()).toHaveLength(0);
      expect(tracker.getCurrentStatus()).toBeUndefined();
    });
  });
});