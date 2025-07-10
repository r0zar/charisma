/**
 * Feature flags for incremental API rollout
 */

export type FeatureFlag = 
  | 'enableApiMetadata'
  | 'enableApiUser'
  | 'enableApiBots'
  | 'enableApiMarket'
  | 'enableApiNotifications';

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const envVar = `NEXT_PUBLIC_ENABLE_API_${flag.replace('enableApi', '').toUpperCase()}`;
  return process.env[envVar] === 'true';
}

/**
 * Get all feature flag states
 */
export function getFeatureFlags(): Record<FeatureFlag, boolean> {
  return {
    enableApiMetadata: isFeatureEnabled('enableApiMetadata'),
    enableApiUser: isFeatureEnabled('enableApiUser'),
    enableApiBots: isFeatureEnabled('enableApiBots'),
    enableApiMarket: isFeatureEnabled('enableApiMarket'),
    enableApiNotifications: isFeatureEnabled('enableApiNotifications'),
  };
}

/**
 * Check if any API features are enabled
 */
export function hasAnyApiFeatures(): boolean {
  const flags = getFeatureFlags();
  return Object.values(flags).some(enabled => enabled);
}