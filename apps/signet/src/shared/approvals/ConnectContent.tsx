/**
 * Connect (standard wallet request): share the active address with a site
 */
import { ShieldCheck, UserRound } from 'lucide-react';
import { PermissionLevel } from './parts/types';
import { FeatureExplanation, RequestHeader } from './parts/UIComponents';
import { t } from '~shared/i18n';
import { short } from '~shared/ui';

export function ConnectContent({ origin, address }: { origin: string; address: string | null }) {
  return (
    <div className="w-approval">
      <RequestHeader level={PermissionLevel.INFO} origin={origin} ask="askConnect" />
      <FeatureExplanation
        icon={<UserRound size={18} color="var(--success)" aria-hidden />}
        text={address ? t('shareAddressAs', short(address)) : t('shareAddress')}
      />
      <FeatureExplanation icon={<ShieldCheck size={18} color="var(--success)" aria-hidden />} text={t('cantMoveFunds')} />
    </div>
  );
}
