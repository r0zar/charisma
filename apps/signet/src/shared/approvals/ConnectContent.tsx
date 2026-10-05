/**
 * Connect (standard wallet request): share the active address with a site
 */
import { ShieldCheck, UserRound } from 'lucide-react';
import { PermissionLevel } from './parts/types';
import { FeatureExplanation, RequestHeader } from './parts/UIComponents';

export function ConnectContent({ origin, address }: { origin: string; address: string | null }) {
  return (
    <div className="w-approval">
      <RequestHeader level={PermissionLevel.INFO} origin={origin} message="wants to connect to Blaze Wallet" />
      <FeatureExplanation
        icon={<UserRound size={18} color="var(--success)" aria-hidden />}
        text={address ? `Share your address ${address.slice(0, 6)}…${address.slice(-4)}` : 'Share your address'}
      />
      <FeatureExplanation icon={<ShieldCheck size={18} color="var(--success)" aria-hidden />} text="It can't move funds: every signature asks you first" />
    </div>
  );
}
