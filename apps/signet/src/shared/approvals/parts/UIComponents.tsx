/**
 * The pieces every approval card shares: the risk pill, the line saying which site asks, and a feature line.
 */
import type { ReactNode } from 'react';
import { t } from '~shared/i18n';
import { PermissionLevel } from './types';

const RISK: Record<PermissionLevel, { pill: string; text: string }> = {
  [PermissionLevel.INFO]: { pill: 'cx-pill-success', text: 'riskLow' },
  [PermissionLevel.SENSITIVE]: { pill: 'cx-pill-warning', text: 'riskReview' },
  // Sends a transaction: often routine (a swap through x-multihop-v2), so no alarm; the card says what can move
  [PermissionLevel.CRITICAL]: { pill: 'cx-pill-warning', text: 'riskReview' },
};

/** Stands in for the site in a translated sentence, so the site can be bolded wherever the language puts it */
const SITE = '\u0000';

/**
 * The risk pill and which site is asking for what: `ask` is the sentence's message key, its $1 the site (shown in
 * bold), and `fills` its other fill-ins ($2…)
 */
export function RequestHeader({ level, origin, ask, fills = [] }: { level: PermissionLevel; origin: string; ask: string; fills?: (string | number)[] }) {
  const [before, after] = t(ask, SITE, ...fills).split(SITE);
  return (
    <>
      <span className={`cx-pill ${RISK[level].pill}`} style={{ alignSelf: 'flex-start' }}>{t(RISK[level].text)}</span>
      <div className="w-origin">{before}<strong>{origin}</strong>{after}</div>
    </>
  );
}

/** An icon and a plain sentence about what approving does */
export function FeatureExplanation({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="w-feature">{icon}<span>{text}</span></div>;
}
