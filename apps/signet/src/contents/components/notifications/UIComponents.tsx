import React from 'react';
import { PermissionLevel, BannerType } from './types';
import { permissionLevelColors, bannerBgColors, bannerBorderColors, commonStyles } from './styles';

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
        boxShadow: `0 0 8px ${permissionLevelColors[level]}aa`,
        animation: 'pulse 2s infinite'
      }}></div>
      <div style={{
        fontSize: '10px',
        fontFamily: 'monospace',
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
      <strong style={{ color: '#fff' }}>{origin}</strong> {message}
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

// Operation type display component
interface OperationTypeDisplayProps {
  type: string;
}

export const OperationTypeDisplay: React.FC<OperationTypeDisplayProps> = ({ type }) => (
  <div style={commonStyles.operationTypeContainer}>
    {type}
  </div>
);

// RememberChoice checkbox component
interface RememberChoiceCheckboxProps {
  checked: boolean;
  onChange: () => void;
}

export const RememberChoiceCheckbox: React.FC<RememberChoiceCheckboxProps> = ({ checked, onChange }) => (
  <div style={commonStyles.checkboxContainer}>
    <label style={commonStyles.checkboxLabel}>
      <div style={{ position: 'relative', width: '16px', height: '16px' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          style={{
            WebkitAppearance: 'none',
            appearance: 'none',
            width: '16px',
            height: '16px',
            border: '1px solid rgba(125, 249, 255, 0.5)',
            background: 'rgba(1, 4, 9, 0.8)',
            borderRadius: '2px',
            position: 'relative',
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 0.2s ease',
            boxShadow: checked ? '0 0 5px rgba(125, 249, 255, 0.5)' : 'none',
            backgroundColor: checked ? 'rgba(125, 249, 255, 0.2)' : 'rgba(1, 4, 9, 0.8)',
            borderColor: checked ? 'rgba(125, 249, 255, 0.8)' : 'rgba(125, 249, 255, 0.5)',
            margin: 0,
            padding: 0
          }}
        />
        {checked && (
          <div style={{
            position: 'absolute',
            left: '5px',
            top: '2px',
            width: '4px',
            height: '8px',
            border: 'solid #7DF9FF',
            borderWidth: '0 2px 2px 0',
            transform: 'rotate(45deg)',
            boxShadow: '0 0 2px rgba(125, 249, 255, 0.8)',
            pointerEvents: 'none'
          }} />
        )}
      </div>
      Remember this decision for this website
    </label>
  </div>
);