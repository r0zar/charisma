import React from 'react';
import { PermissionLevel, BannerType } from './types';
import { permissionLevelColors, bannerBgColors, bannerBorderColors, commonStyles } from './styles';
import { glow } from '~shared/styles/theme';

// Permission level indicator component
interface PermissionLevelIndicatorProps {
  level: PermissionLevel;
}

export const PermissionLevelIndicator: React.FC<PermissionLevelIndicatorProps> = ({ level }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      marginBottom: '12px',
      gap: '6px'
    }}>
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: permissionLevelColors[level],
        boxShadow: `0 0 8px ${glow(permissionLevelColors[level], 0.67)}`,
        animation: 'pulse 2s infinite'
      }}></div>
      <div style={{
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        color: permissionLevelColors[level],
        textTransform: 'uppercase',
        letterSpacing: '1px',
        fontWeight: 'bold'
      }}>
        {level} permission
      </div>
    </div>
  );
};

// Origin banner component
interface OriginBannerProps {
  origin: string;
  type: BannerType;
  message: string;
}

export const OriginBanner: React.FC<OriginBannerProps> = ({ origin, type, message }) => {
  return (
    <div style={{
      background: bannerBgColors[type],
      borderLeft: `2px solid ${bannerBorderColors[type]}`,
      padding: '8px 10px',
      margin: '12px 0',
      fontSize: '11px'
    }}>
      <strong style={{ color: 'var(--ink)' }}>{origin}</strong> {message}
    </div>
  );
};

// Feature explanation component with icon
interface FeatureExplanationProps {
  icon: React.ReactNode;
  text: string;
}

export const FeatureExplanation: React.FC<FeatureExplanationProps> = ({ icon, text }) => (
  <div style={commonStyles.featureItem}>
    <div style={commonStyles.iconContainer}>
      {icon}
    </div>
    <span style={commonStyles.featureText}>{text}</span>
  </div>
);
