/**
 * Configuration Infrastructure
 * Environment variables, feature flags, and loading configuration
 */

// Re-export env config with specific names to avoid conflicts
export { 
  type EnvConfig, 
  getCurrentEnvironment, 
  getDebugInfo,
  getEnvConfig, 
  isClientSide, 
  isServerSide} from './env';

// Re-export feature flags
export {
  type FeatureFlag,
  getFeatureFlags,
  hasAnyApiFeatures,
  isFeatureEnabled} from './feature-flags';

// Re-export loading config
export * from './loading';