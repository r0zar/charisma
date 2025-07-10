/**
 * Configuration Infrastructure
 * Environment variables, feature flags, and loading configuration
 */

// Re-export env config with specific names to avoid conflicts
export { 
  getEnvConfig, 
  getCurrentEnvironment, 
  isServerSide, 
  isClientSide, 
  getDebugInfo,
  type EnvConfig 
} from './env';

// Re-export feature flags
export {
  isFeatureEnabled,
  getFeatureFlags,
  hasAnyApiFeatures,
  type FeatureFlag
} from './feature-flags';

// Re-export loading config
export * from './loading';