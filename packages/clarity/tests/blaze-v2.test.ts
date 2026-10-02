import { describe, expect, it } from "vitest";
import { Cl, ClarityType, getAddressFromPrivateKey, privateKeyToPublic, randomPrivateKey, signMessageHashRsv } from "@stacks/transactions";

// The draft blaze-v2: bearer-key notes and per-signer replay protection (contracts/drafts/BLAZE-V2.md)
const accounts = simnet.getAccounts();
const caller = accounts.get("wallet_1")!; // stands in for the subnet contract (contract-caller)
const thief = accounts.get("wallet_2")!;
const alice = accounts.get("wallet_3")!;

const hashOf = (fn: string, args: ReturnType<typeof Cl.uint>[], sender = caller): string => {
  const { result } = simnet.callReadOnlyFn("blaze-v2", fn, args, sender);
  if (result.type !== ClarityType.ResponseOk || result.value.type !== ClarityType.Buffer) throw new Error(`${fn} failed`);
  return result.value.value;
};
const sign = (hash: string, key: string) => Cl.bufferFromHex(signMessageHashRsv({ messageHash: hash, privateKey: key }));

/** Print a note: a fresh note key, and the issuer's signature binding it to `amount` */
const issueNote = (issuerKey: string, amount: number, uuid: string) => {
  const noteKey = randomPrivateKey();
  const bearer = privateKeyToPublic(noteKey) as string;
  const issueHash = hashOf("hash", [
    Cl.principal(caller), Cl.stringAscii("REDEEM_NOTE"), Cl.none(), Cl.some(Cl.uint(amount)), Cl.none(),
    Cl.some(Cl.bufferFromHex(bearer)), Cl.stringAscii(uuid),
  ]);
  return { noteKey, bearer, issuerSignature: sign(issueHash, issuerKey) };
};

const claim = (noteKey: string, uuid: string, to: string) =>
  sign(hashOf("hash-claim", [Cl.principal(caller), Cl.stringAscii(uuid), Cl.principal(to)]), noteKey);

const redeem = (n: ReturnType<typeof issueNote>, noteSignature: ReturnType<typeof sign>, amount: number, to: string, uuid: string, sender = caller) =>
  simnet.callPublicFn("blaze-v2", "redeem-note",
    [n.issuerSignature, noteSignature, Cl.uint(amount), Cl.bufferFromHex(n.bearer), Cl.principal(to), Cl.stringAscii(uuid)], sender).result;

describe("blaze-v2 bearer-key notes", () => {
  const issuerKey = randomPrivateKey(); // the per-batch key that gets burned after printing
  const issuer = Cl.principal(getAddressFromPrivateKey(issuerKey, "testnet"));

  it("redeems a note to whoever holds its key, and returns the issuer to debit", () => {
    const uuid = "note-1";
    const n = issueNote(issuerKey, 1000, uuid);
    expect(redeem(n, claim(n.noteKey, uuid, alice), 1000, alice, uuid)).toBeOk(issuer);
  });

  it("can't be redirected: a copied claim with a different `to` fails", () => {
    const uuid = "note-2";
    const n = issueNote(issuerKey, 1000, uuid);
    const alicesClaim = claim(n.noteKey, uuid, alice);
    // a mempool watcher reuses Alice's claim signature but pays itself
    expect(redeem(n, alicesClaim, 1000, thief, uuid)).toBeErr(Cl.uint(403000));
    // Alice's own redemption still goes through afterwards
    expect(redeem(n, alicesClaim, 1000, alice, uuid)).toBeOk(issuer);
  });

  it("can't change the amount the issuer signed", () => {
    const uuid = "note-3";
    const n = issueNote(issuerKey, 1000, uuid);
    // a different amount recovers a different "issuer", so the subnet would debit a stranger, not the issuer
    const tampered = redeem(n, claim(n.noteKey, uuid, alice), 999999, alice, uuid);
    expect(tampered).toBeOk(expect.anything());
    expect(tampered).not.toBeOk(issuer);
    expect(redeem(n, claim(n.noteKey, uuid, alice), 1000, alice, uuid)).toBeOk(issuer);
  });

  it("redeems once", () => {
    const uuid = "note-4";
    const n = issueNote(issuerKey, 1000, uuid);
    const c = claim(n.noteKey, uuid, alice);
    expect(redeem(n, c, 1000, alice, uuid)).toBeOk(expect.anything());
    expect(redeem(n, c, 1000, alice, uuid)).toBeErr(Cl.uint(409000));
  });
});

describe("blaze-v2 replay protection", () => {
  it("a junk signature can't burn someone else's uuid", () => {
    const uuid = "order-1";
    const ownerKey = randomPrivateKey();
    const args = (signature: ReturnType<typeof sign>) =>
      [signature, Cl.stringAscii("TRANSFER_TOKENS"), Cl.none(), Cl.some(Cl.uint(5)), Cl.some(Cl.principal(alice)), Cl.stringAscii(uuid)];
    const realHash = hashOf("hash", [
      Cl.principal(caller), Cl.stringAscii("TRANSFER_TOKENS"), Cl.none(), Cl.some(Cl.uint(5)), Cl.some(Cl.principal(alice)), Cl.none(), Cl.stringAscii(uuid),
    ]);
    // a griefer submits the same uuid with a signature from an unrelated key first
    expect(simnet.callPublicFn("blaze-v2", "execute", args(sign(realHash, randomPrivateKey())), caller).result).toBeOk(expect.anything());
    // the owner's real intent with that uuid still executes
    expect(simnet.callPublicFn("blaze-v2", "execute", args(sign(realHash, ownerKey)), caller).result).toBeOk(expect.anything());
    // and is then spent
    expect(simnet.callPublicFn("blaze-v2", "execute", args(sign(realHash, ownerKey)), caller).result).toBeErr(Cl.uint(409000));
  });
});
