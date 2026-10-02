/** The CHA subnets a bet can spend: Blaze v1 (old, still works) and Blaze v2 (where new CHA lands). */
export const CHA_SUBNET_V1 = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1';
export const CHA_SUBNET_V2 = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v2';
export const CHA_SUBNETS = [CHA_SUBNET_V1, CHA_SUBNET_V2] as const;
export type ChaSubnet = (typeof CHA_SUBNETS)[number];
export const isChaSubnet = (s: string): s is ChaSubnet => (CHA_SUBNETS as readonly string[]).includes(s);
/** Bets placed before Blaze v2 carry no subnet: they all spent v1 */
export const subnetOf = (bet: { subnet?: string }): ChaSubnet => (bet.subnet && isChaSubnet(bet.subnet) ? bet.subnet : CHA_SUBNET_V1);
