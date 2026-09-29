import { PermissionLevel, BannerType } from './types';
import { colors } from '~shared/styles/theme';

// Permission level colors
export const permissionLevelColors = {
  [PermissionLevel.INFO]: "#36C758",
  [PermissionLevel.SENSITIVE]: "#FF9500",
  [PermissionLevel.CRITICAL]: "#FF3B30"
};

// Banner colors
export const bannerBgColors = {
  [BannerType.INFO]: 'rgba(54, 199, 88, 0.08)',
  [BannerType.WARNING]: 'rgba(255, 149, 0, 0.08)',
  [BannerType.CRITICAL]: 'rgba(255, 59, 48, 0.1)'
};

export const bannerBorderColors = {
  [BannerType.INFO]: colors.neonGreen,
  [BannerType.WARNING]: colors.neonOrange,
  [BannerType.CRITICAL]: colors.neonRed
};

// Common styles
export const commonStyles = {
  contentContainer: {
    color: '#f8f8f2',
    fontFamily: 'monospace'
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
    color: '#f8f8f2'
  },
  
  operationTypeContainer: {
    fontFamily: 'monospace',
    color: colors.cyber,
    background: 'rgba(125, 249, 255, 0.05)',
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
    background: 'rgba(125, 249, 255, 0.05)',
    borderRadius: '4px'
  },
  
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '10px',
    color: '#8C9CA8',
    gap: '6px'
  }
};