/**
 * Configuration utility tests
 */

import { describe, it, expect } from 'vitest';
import { createDefaultConfig, mergeWithDefaults } from '../../utils/config';

describe('Configuration Utils', () => {
  describe('createDefaultConfig', () => {
    it('should create default configuration with provided service name', () => {
      const serviceName = 'test-registry';
      const config = createDefaultConfig(serviceName);

      expect(config).toEqual({
        serviceName: 'test-registry',
        enableAnalysis: true,
        enableDiscovery: true,
        blobStoragePrefix: 'contracts/',
        analysisTimeout: 30 * 1000, // 30 seconds
        blobStorage: {
          enforcementLevel: 'warn'
        },
        indexManager: {},
        traitAnalyzer: {
          enableSourceAnalysis: true,
          enableRuntimeCheck: false
        },
        discoveryEngine: {
          debug: process.env.NODE_ENV === 'development',
          batchSize: 50,
          maxRetries: 3,
          blacklist: []
        }
      });
    });

    it('should include debug mode based on NODE_ENV', () => {
      const originalEnv = process.env.NODE_ENV;
      
      // Test development mode
      process.env.NODE_ENV = 'development';
      const devConfig = createDefaultConfig('test');
      expect(devConfig.discoveryEngine.debug).toBe(true);

      // Test production mode
      process.env.NODE_ENV = 'production';
      const prodConfig = createDefaultConfig('test');
      expect(prodConfig.discoveryEngine.debug).toBe(false);

      // Restore original env
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge user config with defaults', () => {
      const userConfig = {
        enableAnalysis: false,
        blobStoragePrefix: 'custom-prefix/',
        blobStorage: {
          enforcementLevel: 'warn' as const
        },
        discoveryEngine: {
          batchSize: 25,
          debug: true
        }
      };

      const merged = mergeWithDefaults('test-service', userConfig);

      expect(merged).toEqual({
        serviceName: 'test-service',
        enableAnalysis: false, // User override
        enableDiscovery: true, // Default
        blobStoragePrefix: 'custom-prefix/', // User override
        analysisTimeout: 30 * 1000, // Default
        blobStorage: {
          enforcementLevel: 'warn' // User override
        },
        indexManager: {},
        traitAnalyzer: {
          enableSourceAnalysis: true,
          enableRuntimeCheck: false
        },
        discoveryEngine: {
          debug: true, // User override
          batchSize: 25, // User override
          maxRetries: 3, // Default
          blacklist: [] // Default
        }
      });
    });

    it('should use all defaults when no user config provided', () => {
      const merged = mergeWithDefaults('test-service');
      const defaults = createDefaultConfig('test-service');

      expect(merged).toEqual(defaults);
    });

    it('should handle partial nested config objects', () => {
      const userConfig = {
        traitAnalyzer: {
          enableRuntimeCheck: true
          // enableSourceAnalysis should use default
        }
      };

      const merged = mergeWithDefaults('test-service', userConfig);

      expect(merged.traitAnalyzer).toEqual({
        enableSourceAnalysis: true, // Default
        enableRuntimeCheck: true // User override
      });
    });
  });
});