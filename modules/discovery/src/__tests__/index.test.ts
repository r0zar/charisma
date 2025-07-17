import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getHostUrl, isDevelopment, HOSTS } from '../index';

describe('@modules/discovery', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('isDevelopment', () => {
    it('should return true when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      expect(isDevelopment()).toBe(true);
    });

    it('should return false when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(isDevelopment()).toBe(false);
    });

    it('should return false when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      expect(isDevelopment()).toBe(false);
    });
  });

  describe('getHostUrl', () => {
    it('should return development URL when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      expect(getHostUrl('party')).toBe('http://localhost:1999');
    });

    it('should return production URL when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(getHostUrl('party')).toBe('https://charisma-party.r0zar.partykit.dev');
    });

    it('should return production URL when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      expect(getHostUrl('party')).toBe('https://charisma-party.r0zar.partykit.dev');
    });

    it('should respect explicit environment parameter', () => {
      process.env.NODE_ENV = 'development';
      expect(getHostUrl('party', 'production')).toBe('https://charisma-party.r0zar.partykit.dev');
      expect(getHostUrl('party', 'development')).toBe('http://localhost:1999');
    });

    it('should throw error for unknown host', () => {
      expect(() => getHostUrl('unknown-host' as any)).toThrow('Unknown host: unknown-host');
    });
  });

  describe('HOSTS', () => {
    it('should export HOSTS object', () => {
      expect(HOSTS).toBeDefined();
      expect(HOSTS['party']).toBeDefined();
      expect(HOSTS['party'].development).toBe('http://localhost:1999');
      expect(HOSTS['party'].production).toBe('https://charisma-party.r0zar.partykit.dev');
    });

    it('should include all major service hosts', () => {
      expect(HOSTS['tokens']).toBeDefined();
      expect(HOSTS['tokens'].development).toBe('http://localhost:3000');
      expect(HOSTS['tokens'].production).toBe('https://tokens.charisma.rocks');

      expect(HOSTS['swap']).toBeDefined();
      expect(HOSTS['swap'].development).toBe('http://localhost:3002');
      expect(HOSTS['swap'].production).toBe('https://swap.charisma.rocks');

      expect(HOSTS['invest']).toBeDefined();
      expect(HOSTS['invest'].development).toBe('http://localhost:3003');
      expect(HOSTS['invest'].production).toBe('https://invest.charisma.rocks');

      expect(HOSTS['tx-monitor']).toBeDefined();
      expect(HOSTS['tx-monitor'].development).toBe('http://localhost:3012');
      expect(HOSTS['tx-monitor'].production).toBe('https://tx.charisma.rocks');
    });
  });
});