/**
 * Sign message (standard wallet request): prove who you are by signing text
 */
import { PenLine, ShieldCheck } from 'lucide-react';
import { PermissionLevel } from './parts/types';
import { FeatureExplanation, RequestHeader } from './parts/UIComponents';

export function SignMessageContent({ origin, address, message }: { origin: string; address: string | null; message: string }) {
  return (
    <div className="w-approval">
      <RequestHeader level={PermissionLevel.SENSITIVE} origin={origin} message="wants you to sign this message" />
      <div className="cx-pane w-mono" style={{ maxHeight: '140px', overflowY: 'auto', fontSize: '13px', lineHeight: '19px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {message}
      </div>
      <FeatureExplanation
        icon={<PenLine size={18} color="var(--warning)" aria-hidden />}
        text={address ? `Signs as ${address.slice(0, 6)}…${address.slice(-4)}` : 'Signs with your active account'}
      />
      <FeatureExplanation icon={<ShieldCheck size={18} color="var(--warning)" aria-hidden />} text="Signing a message doesn't move funds" />
    </div>
  );
}
