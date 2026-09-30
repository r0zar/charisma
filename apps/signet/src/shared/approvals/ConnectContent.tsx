import React from 'react';
import { PermissionLevel, BannerType } from './parts/types';
import { PermissionLevelIndicator, OriginBanner, FeatureExplanation } from './parts/UIComponents';
import { commonStyles } from './parts/styles';

/**
 * Connect (standard wallet request): share the active address with a site
 */
export const ConnectContent: React.FC<{ origin: string; address: string | null }> = ({ origin, address }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.INFO} />

    <OriginBanner
      origin={origin}
      type={BannerType.INFO}
      message="wants to connect to Blaze Wallet"
    />

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 21V19A4 4 0 0 0 16 15H8A4 4 0 0 0 4 19V21" stroke="#36C758" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="7" r="4" stroke="#36C758" strokeWidth="1.5" />
          </svg>
        }
        text={address ? `Share your address ${address.slice(0, 6)}…${address.slice(-4)}` : 'Share your address'}
      />

      <FeatureExplanation
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22S20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="#36C758" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        text="It can't move funds: every signature asks you first"
      />
    </div>
  </div>
);
