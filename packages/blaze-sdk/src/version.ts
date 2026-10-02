import { getContractInfo } from "@repo/polyglot";
import { BLAZE_CONTRACT_ID, BLAZE_V1_DOMAIN, BLAZE_V2_CONTRACT_ID, BLAZE_V2_DOMAIN, SUBNET_V2_OF } from "./constants";

export type BlazeVersion = 1 | 2;

const DEPLOYER = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS";

/** Subnets checked on-chain to call .blaze-v1. Contracts can't change, so this is a fact, not a guess */
const V1_SUBNETS = [
    ...[
        "charisma-token-subnet-v1", "welsh-token-subnet-v1", "sbtc-token-subnet-v1", "susdh-token-subnet-v1",
        "leo-token-subnet-v1", "pepe-token-subnet-v1", "hooter-the-owl-subnet", "dmtoken-subnet", "kangaroo-subnet",
        "nope-subnet", "usdh-token-v1-subnet", "skullcoin-stxcity-subnet", "usda-token-subnet", "token-aeusdc-subnet",
        "zest-token-subnet",
    ].map(name => `${DEPLOYER}.${name}`),
    "SP2KGJEAZRDVK78ZWTRGSDE11A1VMZVEATNQFZ73C.world-peace-stacks-stxcity-subnet",
];

// Known subnets never touch the network: a browser reading contract sources without an API key gets rate-limited
const versions = new Map<string, BlazeVersion>([
    ...V1_SUBNETS.map((id): [string, BlazeVersion] => [id, 1]),
    ...Object.values(SUBNET_V2_OF).map((id): [string, BlazeVersion] => [id, 2]),
]);

/**
 * Which Blaze verifier a subnet calls: known subnets from the table above, any other read once from its source and
 * cached. Every intent for a subnet is signed under that version's domain and recovered with that version's contract.
 */
export async function blazeVersionOf(subnet: string): Promise<BlazeVersion> {
    const known = versions.get(subnet);
    if (known) return known;
    let info: Awaited<ReturnType<typeof getContractInfo>>;
    try {
        info = await getContractInfo(subnet);
    } catch (err) {
        throw new Error(`Couldn't check which Blaze version ${subnet} uses: ${(err as Error).message.replace(/\.$/, "")}. Try again in a moment.`);
    }
    if (!info?.source_code) throw new Error(`Subnet ${subnet} was not found on-chain`);
    const version: BlazeVersion = /\.blaze-v2\b/.test(info.source_code) ? 2 : 1;
    versions.set(subnet, version);
    return version;
}

/** A subnet's Blaze version when it's already known (the table above, or read before), without touching the network */
export const knownBlazeVersion = (subnet: string): BlazeVersion | undefined => versions.get(subnet);

export const blazeDomain = (version: BlazeVersion) => (version === 2 ? BLAZE_V2_DOMAIN : BLAZE_V1_DOMAIN);
export const blazeContract = (version: BlazeVersion) => (version === 2 ? BLAZE_V2_CONTRACT_ID : BLAZE_CONTRACT_ID);
