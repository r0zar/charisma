/**
 * TraitDiscoveryEngine Basic Tests
 * Ultra-simple tests to verify core functionality without memory issues
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TraitDiscoveryEngine } from '../../discovery/TraitDiscoveryEngine';

describe('TraitDiscoveryEngine (Basic)', () => {
  let discoveryEngine: TraitDiscoveryEngine;

  beforeEach(() => {
    discoveryEngine = new TraitDiscoveryEngine({
      baseUrl: 'https://api.hiro.so',
      timeout: 5000,
      debug: false,
      batchSize: 1,
      maxRetries: 1,
      retryDelay: 100,
      blacklist: []
    });
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const engine = new TraitDiscoveryEngine();
      expect(engine.getConfig().baseUrl).toBe('https://api.hiro.so');
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        baseUrl: 'https://custom-api.com',
        timeout: 10000
      };

      const engine = new TraitDiscoveryEngine(customConfig);
      const config = engine.getConfig();

      expect(config.baseUrl).toBe('https://custom-api.com');
      expect(config.timeout).toBe(10000);
    });

    it('should allow configuration updates', () => {
      discoveryEngine.updateConfig({ timeout: 15000 });
      expect(discoveryEngine.getConfig().timeout).toBe(15000);
    });
  });

  describe('Blacklist Management', () => {
    it('should add contracts to blacklist', () => {
      discoveryEngine.addToBlacklist(['SP123.contract']);
      expect(discoveryEngine.getBlacklist()).toEqual(['SP123.contract']);
    });

    it('should remove contracts from blacklist', () => {
      discoveryEngine.addToBlacklist(['SP123.contract', 'SP456.contract']);
      discoveryEngine.removeFromBlacklist(['SP456.contract']);
      expect(discoveryEngine.getBlacklist()).toEqual(['SP123.contract']);
    });

    it('should return copy of blacklist', () => {
      discoveryEngine.addToBlacklist(['SP123.contract']);
      const blacklist1 = discoveryEngine.getBlacklist();
      const blacklist2 = discoveryEngine.getBlacklist();

      expect(blacklist1).not.toBe(blacklist2);
      expect(blacklist1).toEqual(blacklist2);
    });
  });
});