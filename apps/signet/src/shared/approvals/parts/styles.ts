import { PermissionLevel, BannerType } from './types';
import { colors } from '~shared/styles/theme';

// Permission level colors
export const permissionLevelColors = {
  [PermissionLevel.INFO]: "var(--success)",
  [PermissionLevel.SENSITIVE]: "var(--warning)",
  [PermissionLevel.CRITICAL]: "var(--danger)"
};

// Banner colors
export const bannerBgColors = {
  [BannerType.INFO]: 'color-mix(in srgb, var(--success) 8%, transparent)',
  [BannerType.WARNING]: 'color-mix(in srgb, var(--warning) 8%, transparent)',
  [BannerType.CRITICAL]: 'color-mix(in srgb, var(--danger) 10%, transparent)'
};

export const bannerBorderColors = {
  [BannerType.INFO]: colors.success,
  [BannerType.WARNING]: colors.warning,
  [BannerType.CRITICAL]: colors.danger
};

// Common styles
export const commonStyles = {
  contentContainer: {
    color: 'var(--ink)',
    fontFamily: 'var(--font-mono)'
  },
  
  explanationContainer: {
    margin: '15px 0'
  },
  
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
    gap: '10px'
  },
  
  iconContainer: {
    width: '20px',
    minWidth: '20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  
  featureText: {
    color: 'var(--ink)'
  },
  
  operationTypeContainer: {
    fontFamily: 'var(--font-mono)',
    color: colors.accent,
    background: 'color-mix(in srgb, var(--hud-accent) 5%, transparent)',
    padding: '4px 8px',
    marginTop: '5px',
    borderRadius: '2px',
    fontSize: '10px',
    letterSpacing: '1px',
    marginLeft: '24px'
  },
  
  checkboxContainer: {
    marginTop: '15px',
    padding: '8px',
    background: 'color-mix(in srgb, var(--hud-accent) 5%, transparent)',
    borderRadius: '4px'
  },
  
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '10px',
    color: 'var(--ink-muted)',
    gap: '6px'
  }
};