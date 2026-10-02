import { describe, expect, it } from "vitest";
import { Cl, ClarityType, getAddressFromPrivateKey, randomPrivateKey, signMessageHashRsv, type ClarityValue } from "@stacks/transactions";

// The STX subnet (contracts/subnets/stx-subnet-v2.clar) and its sublink on Blaze v2, in simnet: native STX in and
// out, signed moves inside, and a route through x-multihop-v2.
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const thief = accounts.get("wallet_2")!;
const c = (name: string) => `${deployer}.${name}`;
const SUBNET = c("stx-subnet-v2"), SUBLINK = c("stx-sublink-v2"), ROUTER = c("x-multihop-v2");

const readBuf = (contract: string, fn: string, args: ClarityValue[]): string => {
  const { result } = simnet.callReadOnlyFn(contract, fn, args, deployer);
  if (result.type !== ClarityType.ResponseOk || result.value.type !== ClarityType.Buffer) throw new Error(`${contract}.${fn} failed`);
  return result.value.value;
};
const sign = (hash: string, key: string) => Cl.bufferFromHex(signMessageHashRsv({ messageHash: hash, privateKey: key }));
const intentHash = (blaze: "blaze-v1" | "blaze-v2", intent: string, amount: number, target: string, uuid: string) =>
  readBuf(blaze, "hash", [Cl.principal(SUBNET), Cl.stringAscii(intent), Cl.none(), Cl.some(Cl.uint(amount)), Cl.some(Cl.principal(target)), Cl.stringAscii(uuid)]);

const stx = (who: string) => simnet.getAssetsMap().get("STX")?.get(who) ?? 0n;
const inSubnet = (who: string) => simnet.callReadOnlyFn(SUBNET, "get-balance", [Cl.principal(who)], deployer).result;

/** a fresh holder with `amount` micro-STX deposited into the subnet */
function holder(amount: number) {
  const key = randomPrivateKey(), who = getAddressFromPrivateKey(key, "testnet");
  simnet.transferSTX(amount + 1_000_000, who, deployer);
  expect(simnet.callPublicFn(SUBNET, "deposit", [Cl.uint(amount), Cl.none()], who).result).toBeOk(Cl.bool(true));
  return { key, who };
}

describe("stx-subnet-v2", () => {
  it("names itself as STX", () => {
    expect(simnet.callReadOnlyFn(SUBNET, "get-symbol", [], deployer).result).toBeOk(Cl.stringAscii("STX"));
    expect(simnet.callReadOnlyFn(SUBNET, "get-decimals", [], deployer).result).toBeOk(Cl.uint(6));
  });

  it("takes STX in and holds it", () => {
    const before = stx(SUBNET);
    const h = holder(5_000_000);
    expect(inSubnet(h.who)).toBeOk(Cl.uint(5_000_000));
    expect(stx(SUBNET) - before).toBe(5_000_000n);
    expect(stx(h.who)).toBe(1_000_000n);
  });

  it("moves a balance inside with one signature, and nobody can replay it", () => {
    const h = holder(3_000_000), to = accounts.get("wallet_4")!, uuid = "stx-x-1";
    const sig = sign(intentHash("blaze-v2", "TRANSFER_TOKENS", 1_000_000, to, uuid), h.key);
    const args = [sig, Cl.uint(1_000_000), Cl.stringAscii(uuid), Cl.principal(to)];
    expect(simnet.callPublicFn(SUBNET, "x-transfer", args, thief).result).toBeOk(Cl.bool(true));
    expect(inSubnet(h.who)).toBeOk(Cl.uint(2_000_000));
    expect(inSubnet(to)).toBeOk(Cl.uint(1_000_000));
    expect(simnet.callPublicFn(SUBNET, "x-transfer", args, thief).result).toBeErr(expect.anything());
  });

  it("refuses a signature made the Blaze v1 way", () => {
    const h = holder(2_000_000), uuid = "stx-v1-sig";
    const sig = sign(intentHash("blaze-v1", "TRANSFER_TOKENS", 1_000_000, thief, uuid), h.key);
    expect(simnet.callPublicFn(SUBNET, "x-transfer", [sig, Cl.uint(1_000_000), Cl.stringAscii(uuid), Cl.principal(thief)], thief).result).toBeErr(expect.anything());
    expect(inSubnet(h.who)).toBeOk(Cl.uint(2_000_000));
  });

  it("pays STX back out to the owner, and to no one else", () => {
    const h = holder(4_000_000);
    expect(simnet.callPublicFn(SUBNET, "withdraw", [Cl.uint(4_000_000), Cl.none()], thief).result).toBeErr(Cl.uint(4000));
    expect(simnet.callPublicFn(SUBNET, "withdraw", [Cl.uint(4_000_000), Cl.none()], h.who).result).toBeOk(Cl.bool(true));
    expect(inSubnet(h.who)).toBeOk(Cl.uint(0));
    expect(stx(h.who)).toBe(5_000_000n);
  });

  it("routes through x-multihop-v2: out of the subnet as STX (0x06), back in (0x05), paid to the signer", () => {
    const h = holder(6_000_000), uuid = "stx-route-1";
    const sig = sign(intentHash("blaze-v2", "TRANSFER_TOKENS", 2_500_000, ROUTER, uuid), h.key);
    const hop = (op: string) => Cl.tuple({ vault: Cl.principal(SUBLINK), opcode: Cl.bufferFromHex(op) });
    const { result } = simnet.callPublicFn("x-multihop-v2", "x-swap-2", [
      Cl.tuple({ token: Cl.principal(SUBNET), amount: Cl.uint(2_500_000), signature: sig, uuid: Cl.stringAscii(uuid) }),
      hop("06"), hop("05"),
      Cl.tuple({ token: Cl.principal(SUBNET), to: Cl.principal(h.who) }),
    ], thief);
    expect(result).toBeOk(expect.anything());
    expect(inSubnet(h.who)).toBeOk(Cl.uint(6_000_000));
    expect(inSubnet(ROUTER)).toBeOk(Cl.uint(0));
    expect(stx(ROUTER)).toBe(0n);
  });
});
