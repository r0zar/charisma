/**
 * Sign message (standard wallet request): prove who you are by signing text
 */
import { PenLine, ShieldCheck } from 'lucide-react';
import { PermissionLevel } from './parts/types';
import { FeatureExplanation, RequestHeader } from './parts/UIComponents';
import { t } from '~shared/i18n';
import { short } from '~shared/ui';

export function SignMessageContent({ origin, address, message }: { origin: string; address: string | null; message: string }) {
  return (
    <div className="w-approval">
      <RequestHeader level={PermissionLevel.SENSITIVE} origin={origin} ask="askSignMessage" />
      <div className="cx-pane w-mono" style={{ maxHeight: '140px', overflowY: 'auto', fontSize: '13px', lineHeight: '19px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {message}
      </div>
      <FeatureExplanation
        icon={<PenLine size={18} color="var(--warning)" aria-hidden />}
        text={address ? t('signsAs', short(address)) : t('signsWithActive')}
      />
      <FeatureExplanation icon={<ShieldCheck size={18} color="var(--warning)" aria-hidden />} text={t('messageMovesNothing')} />
    </div>
  );
}
