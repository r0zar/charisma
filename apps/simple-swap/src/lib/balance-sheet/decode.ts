import type { MempoolTransaction, PostCondition, PostConditionFungible, PostConditionStx, Transaction } from '@stacks/stacks-blockchain-api-types';
import { Cl, ClarityType, type ClarityValue } from '@stacks/transactions';
import { MULTIHOP_CONTRACT_IDS, WRAPPED_STX_CONTRACT_ID } from 'blaze-sdk';
import { defaultConfig, OPCODES, type Vault } from 'dexterity-sdk';
import type { SignedIntent } from '../blaze-signer';
import type { EntryKind } from './types';

/**
 * Reads a transaction waiting to be mined into what it will do to each wallet's balances, from the transaction alone:
 * nobody has to report it. Knows plain transfers, network fees, Blaze subnets (moving in and out, signed transfers) and
 * Charisma's routers (wallet swaps and Blaze orders). Anything else only shows its fee until its block lands.
 */

export const STX = '.stx';
/** The router wallet swaps go through */
const WALLET_ROUTER = defaultConfig.routerContractId;

/** Wrapped-STX tokens whose transfer moves real STX: ALEX counts in 8 decimals, Velar in micro-STX */
const STX_WRAPPERS: Record<string, (amount: bigint) => bigint> = {
    'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-wstx': amount => (amount * 1_000_000n) / 100_000_000n,
    [WRAPPED_STX_CONTRACT_ID]: amount => amount,
};

/** A transaction waiting to be mined, or one already mined (the same fields describe what it does) */
export type Tx = MempoolTransaction | Transaction;

/** What one transaction will do to one wallet's balance of one token */
export interface Effect {
    address: string;
    token: string;
    kind: EntryKind;
    /** Smallest units, signed. A swap's output is its likely amount */
    amount: bigint;
    /** The least a swap's output can settle at, when its post-conditions guarantee one */
    min?: bigint;
    counterparty?: string;
}

/** What decoding needs from the outside world, so it can run (and be tested) without the network */
export interface DecodeDeps {
    /** A Blaze subnet's base token (".stx" for STX); undefined for anything that isn't a subnet */
    baseOf(contractId: string): string | undefined;
    /** A pool or sublink Charisma's routers swap through */
    vault(contractId: string): Vault | undefined;
    /** What a vault pays out for `amount` under `opcode`; null when it can't quote */
    quote(vault: Vault, amount: bigint, opcode: number): Promise<bigint | null>;
    /** Who signed a Blaze intent */
    signer(intent: SignedIntent): Promise<string>;
}

type Args = Record<string, ClarityValue>;

const uint = (cv?: ClarityValue) => (cv?.type === ClarityType.UInt ? BigInt(cv.value) : undefined);
const principal = (cv?: ClarityValue) =>
    cv?.type === ClarityType.PrincipalStandard || cv?.type === ClarityType.PrincipalContract ? cv.value : undefined;
const some = (cv?: ClarityValue) => (cv?.type === ClarityType.OptionalSome ? cv.value : undefined);
const tuple = (cv?: ClarityValue) => (cv?.type === ClarityType.Tuple ? cv.value : undefined);
const buffer = (cv?: ClarityValue) => (cv?.type === ClarityType.Buffer ? cv.value : undefined);
const ascii = (cv?: ClarityValue) => (cv?.type === ClarityType.StringASCII ? cv.value : undefined);

/** A router hop's opcode: its first byte (wallet swaps wrap it in an optional) */
const opcodeOf = (cv?: ClarityValue) => {
    const hex = buffer(cv) ?? buffer(some(cv));
    return hex === undefined ? undefined : parseInt(hex.slice(0, 2) || '00', 16);
};

/** Which way a vault moves tokens under an opcode: swaps and deposits go A to B, their reverses B to A */
const aToB = (opcode: number) => opcode === OPCODES.SWAP_A_TO_B || opcode === OPCODES.OP_DEPOSIT;

/** The token a vault's side holds, in the wallet's terms (STX as ".stx") */
const tokenId = (contractId: string) => (contractId === 'stx' || contractId === STX ? STX : contractId);

export async function effectsOf(tx: Tx, deps: DecodeDeps): Promise<Effect[]> {
    const effects: Effect[] = [];
    // Whoever pays the fee pays it whether or not the rest works out
    const payer = tx.sponsored && tx.sponsor_address ? tx.sponsor_address : tx.sender_address;
    if (BigInt(tx.fee_rate) > 0n) effects.push({ address: payer, token: STX, kind: 'fee', amount: -BigInt(tx.fee_rate) });

    if (tx.tx_type === 'token_transfer') {
        const { recipient_address: to, amount } = tx.token_transfer;
        effects.push(...transfer(STX, tx.sender_address, to, BigInt(amount)));
    } else if (tx.tx_type === 'contract_call') {
        const { contract_id: contract, function_name: fn, function_args = [] } = tx.contract_call;
        const args: Args = Object.fromEntries(function_args.map(a => [a.name, Cl.deserialize(a.hex)]));
        const positional = function_args.map(a => args[a.name]);
        effects.push(...(await callEffects(contract, fn, args, positional, tx, deps)));
    }
    return effects.filter(e => e.amount !== 0n);
}

const transfer = (token: string, from: string, to: string, amount: bigint, kind: EntryKind = 'transfer'): Effect[] => [
    { address: from, token, kind, amount: -amount, counterparty: to },
    { address: to, token, kind, amount, counterparty: from },
];

async function callEffects(contract: string, fn: string, args: Args, positional: ClarityValue[], tx: Tx, deps: DecodeDeps): Promise<Effect[]> {
    const sender = tx.sender_address;

    // SIP-10 transfer (subnets keep the same shape): amount, from, to, memo
    if (fn === 'transfer' && positional.length === 4) {
        const [amount, from, to] = [uint(positional[0]), principal(positional[1]), principal(positional[2])];
        if (amount === undefined || !from || !to) return [];
        const asStx = STX_WRAPPERS[contract];
        return asStx ? transfer(STX, from, to, asStx(amount)) : transfer(contract, from, to, amount);
    }

    if (contract === WALLET_ROUTER && /^swap-\d+$/.test(fn)) return walletSwap(args, tx, deps);
    if (MULTIHOP_CONTRACT_IDS.includes(contract) && /^x-swap-\d+$/.test(fn)) return orderSwap(contract, args, tx, deps);

    const base = deps.baseOf(contract);
    if (!base) return [];
    const amount = uint(args.amount);
    const recipient = principal(some(args.recipient)) ?? sender;
    if (fn === 'deposit' && amount !== undefined) {
        return [
            { address: sender, token: base, kind: 'deposit', amount: -amount, counterparty: contract },
            { address: recipient, token: contract, kind: 'deposit', amount },
        ];
    }
    if (fn === 'withdraw' && amount !== undefined) {
        return [
            { address: sender, token: contract, kind: 'withdraw', amount: -amount },
            { address: recipient, token: base, kind: 'withdraw', amount, counterparty: contract },
        ];
    }

    // Signed Blaze transfers: the subnet moves the signer's balance, whoever sends the transaction
    const to = principal(args.to);
    const signature = buffer(args.signature);
    const uuid = ascii(args.uuid);
    if (fn === 'x-transfer' && to && signature && uuid && amount !== undefined) {
        const from = await deps.signer({ signature, contract, intent: 'TRANSFER_TOKENS', amount, target: to, uuid });
        return transfer(contract, from, to, amount);
    }
    const bound = uint(args.bound), actual = uint(args.actual);
    if (fn === 'x-transfer-lte' && to && signature && uuid && bound !== undefined && actual !== undefined) {
        const from = await deps.signer({ signature, contract, intent: 'TRANSFER_TOKENS_LTE', amount: bound, target: to, uuid });
        return transfer(contract, from, to, actual);
    }
    // Bearer notes: the recipient is plain; who issued it isn't, so only the arriving side shows early
    if ((fn === 'x-redeem' || fn === 'x-redeem-note') && to && amount !== undefined) {
        return [{ address: to, token: contract, kind: 'transfer', amount }];
    }
    return [];
}

interface Leg { vault: Vault; opcode: number }

/** A route's legs, in order; undefined when any hop goes through a vault the router doesn't know */
function legsOf(args: Args, vaultField: 'pool' | 'vault', deps: DecodeDeps): Leg[] | undefined {
    const hops = Object.keys(args).filter(name => /^hop-\d+$/.test(name)).sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
    const legs: Leg[] = [];
    for (const name of hops) {
        const hop = tuple(args[name]);
        const vault = deps.vault(principal(hop?.[vaultField]) ?? '');
        const opcode = opcodeOf(hop?.opcode);
        if (!vault || opcode === undefined) return undefined;
        legs.push({ vault, opcode });
    }
    return legs.length ? legs : undefined;
}

/** A route that only moves a token onto Blaze (or back) is a move, not a trade */
const routeKind = (legs: Leg[]): EntryKind =>
    legs.every(l => l.opcode === OPCODES.OP_DEPOSIT) ? 'deposit' : legs.every(l => l.opcode === OPCODES.OP_WITHDRAW) ? 'withdraw' : 'swap';

/** What the route pays out for `amount`, quoted hop by hop at the pools' current state */
async function quoteRoute(legs: Leg[], amount: bigint, deps: DecodeDeps): Promise<bigint | null> {
    let out: bigint | null = amount;
    for (const { vault, opcode } of legs) {
        out = await deps.quote(vault, out, opcode);
        if (out === null) return null;
    }
    return out;
}

/** The smallest amount of `token` some other principal promises to send (a ≥ post-condition), if the route set one */
function guaranteed(postConditions: PostCondition[], token: string): bigint | undefined {
    const [address, name] = token.split('.');
    const amounts = postConditions
        .filter((pc): pc is PostConditionStx | PostConditionFungible =>
            pc.type === 'stx' ? token === STX : pc.type === 'fungible' && pc.asset.contract_address === address && pc.asset.contract_name === name)
        .filter(pc => pc.condition_code === 'sent_greater_than_or_equal_to' || pc.condition_code === 'sent_greater_than')
        .map(pc => BigInt(pc.amount));
    return amounts.length ? amounts.reduce((a, b) => (a < b ? a : b)) : undefined;
}

/**
 * The guaranteed output of a route that ends on a Blaze subnet: its last swap's ≥ post-condition, since moving
 * into a subnet is one to one and a subnet balance can't carry a post-condition of its own
 */
function routeMin(legs: Leg[], output: string, postConditions: PostCondition[], deps: DecodeDeps): bigint | undefined {
    const last = legs[legs.length - 1];
    const landing = last.opcode === OPCODES.OP_DEPOSIT ? deps.baseOf(output) : output;
    return landing ? guaranteed(postConditions, landing) : undefined;
}

/** A wallet swap through the multihop router: the sender pays the first hop's token and gets the last hop's */
async function walletSwap(args: Args, tx: Tx, deps: DecodeDeps): Promise<Effect[]> {
    const amount = uint(args.amount);
    const legs = legsOf(args, 'pool', deps);
    if (amount === undefined || !legs) return [];
    const first = legs[0], last = legs[legs.length - 1];
    const input = tokenId(aToB(first.opcode) ? first.vault.tokenA.contractId : first.vault.tokenB.contractId);
    const output = tokenId(aToB(last.opcode) ? last.vault.tokenB.contractId : last.vault.tokenA.contractId);
    return [
        { address: tx.sender_address, token: input, kind: routeKind(legs), amount: -amount },
        ...(await swapOutput(tx.sender_address, output, legs, amount, tx, deps)),
    ];
}

/** A Blaze order run by a solver: the signer pays from their subnet, and `out.to` gets the output */
async function orderSwap(router: string, args: Args, tx: Tx, deps: DecodeDeps): Promise<Effect[]> {
    const input = tuple(args.in), out = tuple(args.out);
    const token = principal(input?.token), amount = uint(input?.amount), signature = buffer(input?.signature), uuid = ascii(input?.uuid);
    const to = principal(out?.to), output = principal(out?.token);
    const legs = legsOf(args, 'vault', deps);
    if (!token || amount === undefined || !signature || !uuid || !to || !output || !legs) return [];
    const signer = await deps.signer({ signature, contract: token, intent: 'TRANSFER_TOKENS', amount, target: router, uuid });
    return [
        { address: signer, token, kind: routeKind(legs), amount: -amount, ...(to !== signer && { counterparty: to }) },
        ...(await swapOutput(to, tokenId(output), legs, amount, tx, deps)),
    ];
}

async function swapOutput(to: string, output: string, legs: Leg[], amount: bigint, tx: Tx, deps: DecodeDeps): Promise<Effect[]> {
    const min = routeMin(legs, output, tx.post_conditions, deps);
    const likely = (await quoteRoute(legs, amount, deps)) ?? min;
    if (likely === undefined) return [];
    // A quote can come in under the guarantee when the pools moved; the guarantee is what the chain enforces
    const amountOut = min !== undefined && likely < min ? min : likely;
    return [{ address: to, token: output, kind: routeKind(legs), amount: amountOut, ...(min !== undefined && { min }) }];
}
