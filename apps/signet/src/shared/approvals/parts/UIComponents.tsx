/**
 * The pieces every approval card shares: the risk pill, the line saying which site asks, and a feature line.
 */
import type { ReactNode } from 'react';
import { PermissionLevel } from './types';

const RISK: Record<PermissionLevel, { pill: string; text: string }> = {
  [PermissionLevel.INFO]: { pill: 'cx-pill-success', text: 'Low risk' },
  [PermissionLevel.SENSITIVE]: { pill: 'cx-pill-warning', text: 'Review carefully' },
  // Sends a transaction: often routine (a swap through x-multihop-v2), so no alarm; the card says what can move
  [PermissionLevel.CRITICAL]: { pill: 'cx-pill-warning', text: 'Review carefully' },
};

/** The risk pill and which site is asking for what */
export function RequestHeader({ level, origin, message }: { level: PermissionLevel; origin: string; message: string }) {
  return (
    <>
      <span className={`cx-pill ${RISK[level].pill}`} style={{ alignSelf: 'flex-start' }}>{RISK[level].text}</span>
      <div className="w-origin"><strong>{origin}</strong> {message}</div>
    </>
  );
}

/** An icon and a plain sentence about what approving does */
export function FeatureExplanation({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="w-feature">{icon}<span>{text}</span></div>;
}
