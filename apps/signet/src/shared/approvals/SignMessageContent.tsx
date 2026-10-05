import React from 'react';
import { PermissionLevel, BannerType } from './parts/types';
import { PermissionLevelIndicator, OriginBanner, FeatureExplanation } from './parts/UIComponents';
import { commonStyles } from './parts/styles';

/**
 * Sign message (standard wallet request): prove who you are by signing text
 */
export const SignMessageContent: React.FC<{ origin: string; address: string | null; message: string }> = ({ origin, address, message }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.SENSITIVE} />

    <OriginBanner
      origin={origin}
      type={BannerType.WARNING}
      message="wants you to sign this message"
    />

    <div
      className="signet-scrollbar"
      style={{
        maxHeight: '140px',
        overflowY: 'auto',
        padding: '8px 10px',
        margin: '10px 0',
        background: 'color-mix(in srgb, var(--hud-accent) 5%, transparent)',
        border: '1px solid color-mix(in srgb, var(--hud-accent) 20%, transparent)',
        borderRadius: '4px',
        fontSize: '11px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}
    >
      {message}
    </div>

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 20H21" style={{ stroke: "var(--warning)" }} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M16.5 3.5A2.1 2.1 0 0 1 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" style={{ stroke: "var(--warning)" }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        text={address ? `Signs as ${address.slice(0, 6)}…${address.slice(-4)}` : 'Signs with your active account'}
      />

      <FeatureExplanation
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22S20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" style={{ stroke: "var(--warning)" }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        text="Signing a message doesn't move funds"
      />
    </div>
  </div>
);
