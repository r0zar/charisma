import { describe, expect, it } from "vitest";
import { Cl, ClarityType, getAddressFromPrivateKey, randomPrivateKey, signMessageHashRsv, type ClarityValue } from "@stacks/transactions";

// Blaze v2 (contracts/drafts/BLAZE-V2.md): the verifier, the x-multihop-v2 router, and subnets built from the
// Launchpad templates (contracts/test/welsh-*), exercised end to end in simnet.
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const thief = accounts.get("wallet_2")!;
const alice = accounts.get("wallet_3")!;
const c = (name: string) => `${deployer}.${name}`;
const ROUTER = c("x-multihop-v2");

const readBuf = (contract: string, fn: string, args: ClarityValue[]): string => {
  const { result } = simnet.callReadOnlyFn(contract, fn, args, deployer);
  if (result.type !== ClarityType.ResponseOk || result.value.type !== ClarityType.Buffer) throw new Error(`${contract}.${fn} failed`);
  return result.value.value;
};
const sign = (hash: string, key: string) => Cl.bufferFromHex(signMessageHashRsv({ messageHash: hash, privateKey: key }));
const addr = (key: string) => getAddressFromPrivateKey(key, "testnet");

/** an intent hash under a given Blaze version (both hash the same tuple; only the domain differs) */
const intentHash = (blaze: "blaze-v1" | "blaze-v2", subnet: string, intent: string, amount: number, target: string | null, uuid: string) =>
  readBuf(blaze, "hash", [Cl.principal(subnet), Cl.stringAscii(intent), Cl.none(), Cl.some(Cl.uint(amount)), target ? Cl.some(Cl.principal(target)) : Cl.none(), Cl.stringAscii(uuid)]);

const welsh = (who: string) => {
  const { result } = simnet.callReadOnlyFn("welshcorgicoin-token", "get-balance", [Cl.principal(who)], deployer);
  return result;
};
const subnetBalance = (subnet: string, who: string) => simnet.callReadOnlyFn(subnet, "get-balance", [Cl.principal(who)], deployer).result;

/** a fresh player with `amount` WELSH deposited into a subnet */
function player(subnet: string, amount: number) {
  const key = randomPrivateKey(), who = addr(key);
  simnet.callPublicFn("welshcorgicoin-token", "transfer", [Cl.uint(amount), Cl.principal(deployer), Cl.principal(who), Cl.none()], deployer);
  expect(simnet.callPublicFn(subnet, "deposit", [Cl.uint(amount), Cl.none()], who).result).toBeOk(Cl.bool(true));
  return { key, who };
}

const inTuple = (subnet: string, amount: number, signature: ClarityValue, uuid: string) =>
  Cl.tuple({ token: Cl.principal(subnet), amount: Cl.uint(amount), signature, uuid: Cl.stringAscii(uuid) });
const hop = (vault: string, op: string) => Cl.tuple({ vault: Cl.principal(vault), opcode: Cl.bufferFromHex(op) });
const outTuple = (token: string, to: string) => Cl.tuple({ token: Cl.principal(token), to: Cl.principal(to) });

describe("x-multihop-v2: one router for both Blaze versions", () => {
  it("swaps a v2 subnet balance out to the signer", () => {
    const p = player("welsh-subnet-v2", 1000), uuid = "v2-swap-1";
    const sig = sign(intentHash("blaze-v2", c("welsh-subnet-v2"), "TRANSFER_TOKENS", 400, ROUTER, uuid), p.key);
    const { result } = simnet.callPublicFn("x-multihop-v2", "x-swap-1",
      [inTuple(c("welsh-subnet-v2"), 400, sig, uuid), hop(c("welsh-sublink-v2"), "06"), outTuple(c("welshcorgicoin-token"), p.who)], thief);
    expect(result).toBeOk(expect.anything());
    expect(welsh(p.who)).toBeOk(Cl.uint(400));
    expect(subnetBalance("welsh-subnet-v2", p.who)).toBeOk(Cl.uint(600));
  });

  it("still swaps a v1 subnet balance, signed the v1 way", () => {
    const p = player("welsh-subnet-v1", 1000), uuid = "v1-swap-1";
    const sig = sign(intentHash("blaze-v1", c("welsh-subnet-v1"), "TRANSFER_TOKENS", 300, ROUTER, uuid), p.key);
    const { result } = simnet.callPublicFn("x-multihop-v2", "x-swap-1",
      [inTuple(c("welsh-subnet-v1"), 300, sig, uuid), hop(c("welsh-sublink-v1"), "06"), outTuple(c("welshcorgicoin-token"), p.who)], thief);
    expect(result).toBeOk(expect.anything());
    expect(welsh(p.who)).toBeOk(Cl.uint(300));
  });

  it("refuses to pay anyone but the signer", () => {
    const p = player("welsh-subnet-v2", 1000), uuid = "v2-swap-2";
    const sig = sign(intentHash("blaze-v2", c("welsh-subnet-v2"), "TRANSFER_TOKENS", 400, ROUTER, uuid), p.key);
    const { result } = simnet.callPublicFn("x-multihop-v2", "x-swap-1",
      [inTuple(c("welsh-subnet-v2"), 400, sig, uuid), hop(c("welsh-sublink-v2"), "06"), outTuple(c("welshcorgicoin-token"), thief)], thief);
    expect(result).toBeErr(Cl.uint(403));
  });

  it("a v2 signature can't move a v1 balance", () => {
    const p = player("welsh-subnet-v1", 1000), uuid = "cross-1";
    const sig = sign(intentHash("blaze-v2", c("welsh-subnet-v1"), "TRANSFER_TOKENS", 300, ROUTER, uuid), p.key);
    // the router accepts it (it's the signer's), but the v1 subnet checks it under v1 and finds a stranger with nothing
    expect(() => simnet.callPublicFn("x-multihop-v2", "x-swap-1",
      [inTuple(c("welsh-subnet-v1"), 300, sig, uuid), hop(c("welsh-sublink-v1"), "06"), outTuple(c("welshcorgicoin-token"), p.who)], thief)).toThrow();
    expect(subnetBalance("welsh-subnet-v1", p.who)).toBeOk(Cl.uint(1000));
  });

  it("upgrades a v1 balance to v2 with one signature: v1 sublink out, v2 sublink in", () => {
    const p = player("welsh-subnet-v1", 1000), uuid = "upgrade-1";
    const sig = sign(intentHash("blaze-v1", c("welsh-subnet-v1"), "TRANSFER_TOKENS", 1000, ROUTER, uuid), p.key);
    const { result } = simnet.callPublicFn("x-multihop-v2", "x-swap-2",
      [inTuple(c("welsh-subnet-v1"), 1000, sig, uuid), hop(c("welsh-sublink-v1"), "06"), hop(c("welsh-sublink-v2"), "05"), outTuple(c("welsh-subnet-v2"), p.who)], thief);
    expect(result).toBeOk(expect.anything());
    expect(subnetBalance("welsh-subnet-v1", p.who)).toBeOk(Cl.uint(0));
    expect(subnetBalance("welsh-subnet-v2", p.who)).toBeOk(Cl.uint(1000));
  });
});

describe("blaze-v2: cancel for good", () => {
  it("a revoked uuid can never execute", () => {
    const p = player("welsh-subnet-v2", 1000), uuid = "revoke-1";
    const sig = sign(intentHash("blaze-v2", c("welsh-subnet-v2"), "TRANSFER_TOKENS", 400, ROUTER, uuid), p.key);
    expect(simnet.callPublicFn("blaze-v2", "revoke", [Cl.stringAscii(uuid)], p.who).result).toBeOk(Cl.bool(true));
    expect(simnet.callReadOnlyFn("blaze-v2", "check", [Cl.principal(p.who), Cl.stringAscii(uuid)], deployer).result).toBeBool(true);
    // the router unwraps the subnet's x-transfer (as v1 does), so a spent uuid aborts the whole transaction
    expect(() => simnet.callPublicFn("x-multihop-v2", "x-swap-1",
      [inTuple(c("welsh-subnet-v2"), 400, sig, uuid), hop(c("welsh-sublink-v2"), "06"), outTuple(c("welshcorgicoin-token"), p.who)], thief)).toThrow();
    expect(simnet.callPublicFn("welsh-subnet-v2", "x-transfer", [sig, Cl.uint(400), Cl.stringAscii(uuid), Cl.principal(ROUTER)], thief).result).toBeErr(Cl.uint(409000));
    expect(subnetBalance("welsh-subnet-v2", p.who)).toBeOk(Cl.uint(1000));
  });

  it("revoking someone else's uuid only spends it for yourself", () => {
    const p = player("welsh-subnet-v2", 1000), uuid = "revoke-2";
    expect(simnet.callPublicFn("blaze-v2", "revoke", [Cl.stringAscii(uuid)], thief).result).toBeOk(Cl.bool(true));
    const sig = sign(intentHash("blaze-v2", c("welsh-subnet-v2"), "TRANSFER_TOKENS", 400, ROUTER, uuid), p.key);
    expect(simnet.callPublicFn("x-multihop-v2", "x-swap-1",
      [inTuple(c("welsh-subnet-v2"), 400, sig, uuid), hop(c("welsh-sublink-v2"), "06"), outTuple(c("welshcorgicoin-token"), p.who)], thief).result).toBeOk(expect.anything());
  });
});

describe("blaze-v2: replay protection per signer", () => {
  it("a junk signature can't burn someone else's uuid", () => {
    const p = player("welsh-subnet-v2", 1000), uuid = "junk-1";
    const real = intentHash("blaze-v2", c("welsh-subnet-v2"), "TRANSFER_TOKENS", 5, alice, uuid);
    const xfer = (sig: ClarityValue) => simnet.callPublicFn("welsh-subnet-v2", "x-transfer", [sig, Cl.uint(5), Cl.stringAscii(uuid), Cl.principal(alice)], thief).result;
    expect(xfer(sign(real, randomPrivateKey()))).toBeErr(Cl.uint(4000)); // a stranger with no balance
    expect(xfer(sign(real, p.key))).toBeOk(Cl.bool(true));                // the owner's intent still runs
    expect(xfer(sign(real, p.key))).toBeErr(Cl.uint(409000));             // and then it's spent
  });
});

describe("blaze-v2: bearer notes through a v2 subnet", () => {
  const issueNote = (issuerKey: string, amount: number, uuid: string) => {
    const noteKey = randomPrivateKey();
    const issuerSignature = sign(intentHash("blaze-v2", c("welsh-subnet-v2"), "REDEEM_NOTE", amount, addr(noteKey), uuid), issuerKey);
    return { noteKey, issuerSignature };
  };
  const claim = (noteKey: string, uuid: string, to: string) =>
    sign(readBuf("blaze-v2", "hash-claim", [Cl.principal(c("welsh-subnet-v2")), Cl.stringAscii(uuid), Cl.principal(to)]), noteKey);
  const redeem = (n: ReturnType<typeof issueNote>, noteSig: ClarityValue, amount: number, to: string, uuid: string) =>
    simnet.callPublicFn("welsh-subnet-v2", "x-redeem-note", [n.issuerSignature, noteSig, Cl.uint(amount), Cl.stringAscii(uuid), Cl.principal(to)], thief).result;

  it("pays whoever holds the note key, to the address they choose", () => {
    const issuer = player("welsh-subnet-v2", 5000), uuid = "note-1";
    const n = issueNote(issuer.key, 1000, uuid);
    expect(redeem(n, claim(n.noteKey, uuid, alice), 1000, alice, uuid)).toBeOk(Cl.bool(true));
    expect(subnetBalance("welsh-subnet-v2", alice)).toBeOk(Cl.uint(1000));
    expect(redeem(n, claim(n.noteKey, uuid, alice), 1000, alice, uuid)).toBeErr(Cl.uint(409000)); // once
  });

  it("can't be redirected or inflated by someone who copies it from the mempool", () => {
    const issuer = player("welsh-subnet-v2", 5000), uuid = "note-2";
    const n = issueNote(issuer.key, 1000, uuid);
    const alicesClaim = claim(n.noteKey, uuid, alice);
    expect(redeem(n, alicesClaim, 1000, thief, uuid)).toBeErr(Cl.uint(4000));   // a different `to`: a stranger pays, and has nothing
    expect(redeem(n, alicesClaim, 4000, alice, uuid)).toBeErr(Cl.uint(4000));   // a bigger amount: same
    expect(redeem(n, alicesClaim, 1000, alice, uuid)).toBeOk(Cl.bool(true));    // the real redemption still works
    expect(subnetBalance("welsh-subnet-v2", issuer.who)).toBeOk(Cl.uint(4000));
  });
});
