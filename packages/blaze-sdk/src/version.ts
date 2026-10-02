import { getContractInfo } from "@repo/polyglot";
import { BLAZE_CONTRACT_ID, BLAZE_V1_DOMAIN, BLAZE_V2_CONTRACT_ID, BLAZE_V2_DOMAIN, CHARISMA_SUBNET_V2_CONTRACT_ID } from "./constants";

export type BlazeVersion = 1 | 2;

const versions = new Map<string, BlazeVersion>([[CHARISMA_SUBNET_V2_CONTRACT_ID, 2]]);

/**
 * Which Blaze verifier a subnet calls, read once from its source and cached. Every intent for a subnet is signed under
 * that version's domain and recovered with that version's contract.
 */
export async function blazeVersionOf(subnet: string): Promise<BlazeVersion> {
    const known = versions.get(subnet);
    if (known) return known;
    const info = await getContractInfo(subnet);
    if (!info?.source_code) throw new Error(`Subnet ${subnet} was not found on-chain`);
    const version: BlazeVersion = /\.blaze-v2\b/.test(info.source_code) ? 2 : 1;
    versions.set(subnet, version);
    return version;
}

export const blazeDomain = (version: BlazeVersion) => (version === 2 ? BLAZE_V2_DOMAIN : BLAZE_V1_DOMAIN);
export const blazeContract = (version: BlazeVersion) => (version === 2 ? BLAZE_V2_CONTRACT_ID : BLAZE_CONTRACT_ID);
