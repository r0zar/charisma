# Blaze v2 (draft)

**Status:** an idea saved for later. It is not deployed and not scheduled. `blaze-v2.clar` compiles in this project,
and `tests/blaze-v2.test.ts` checks the behaviour below in simnet. No subnet contract calls it yet.

Blaze v2 keeps everything blaze-v1 does (SIP-018 intents, verified on-chain) and fixes two things.

| | blaze-v1 (live) | blaze-v2 (draft) |
|---|---|---|
| Bearer notes (`REDEEM_BEARER`) | The note *is* a signature, and the payout address isn't signed. Redeeming broadcasts the signature, so a mempool watcher can copy it and pay itself first. | The note holds a **note key**. Redeeming signs "pay **this** address" with it. A copied claim can't be redirected. |
| Replay protection | One global set of used uuids, written before the signature is checked. Anyone can burn someone else's uuid with a junk signature. | Keyed by **(signer, uuid)** and written after recovery. Junk signatures only spend uuids for random principals. |
| Domain | `BLAZE_PROTOCOL` / `v1.0` | `BLAZE_PROTOCOL` / `v2.0` (v1 signatures can't be replayed on v2) |
| Intent hash | `{contract, intent, opcode, amount, target, uuid}` | the same plus `bearer: (optional (buff 33))`, the note's public key or `none` |

## Bearer notes: paper cash on Bitcoin

The goal: put a note's secret under a scratch-off, hand the paper to anyone, and whoever holds it can redeem to any
address they choose. It never pays the signer.

```mermaid
sequenceDiagram
    participant Printer
    participant Paper
    participant Holder
    participant Subnet as Subnet token (v2)
    participant Blaze as blaze-v2
    Note over Printer: Fresh issuer key for the batch, funded in the subnet
    Printer->>Printer: Per note: fresh note key; issuer signs {REDEEM_NOTE, amount, bearer: note pubkey, uuid}
    Printer->>Paper: Print issuer signature + note key under the scratch-off
    Note over Printer: Burn the issuer key: funds can now only leave through notes
    Paper->>Holder: Handed over like cash
    Holder->>Holder: Sign claim {contract, claim: uuid, to: my address} with the note key
    Holder->>Subnet: x-redeem-note(issuer sig, claim sig, amount, bearer, to, uuid)
    Subnet->>Blaze: redeem-note(...)
    Blaze-->>Subnet: issuer (both signatures valid, uuid unused)
    Subnet->>Holder: Move amount from issuer to `to`
```

**Why it can't be front-run.** The contract checks two signatures. The issuer's signature commits to the note's public
key, and the note key's signature commits to the payout address. Someone who copies the transaction from the mempool can
resend it unchanged, but that still pays the holder. Changing `to` needs the note key, which never goes on-chain.

**What still rests on trust.** Whoever prints a note sees its key. That was true in v1 as well, and it's the printer's job.
The burned issuer key is the escrow: once it's gone, nobody can move the batch's subnet balance except through note
redemptions. An optional upgrade is a vault contract with no withdraw function, only "pay a valid note", which would make
that burn provable on-chain.

## Subnet integration

A v2 subnet token would add one function next to its `x-transfer` and friends:

```clarity
(define-public (x-redeem-note
    (issuer-signature (buff 65))
    (note-signature   (buff 65))
    (amount           uint)
    (bearer           (buff 33))
    (to               principal)
    (uuid             (string-ascii 36)))
  (let ((issuer (try! (contract-call? .blaze-v2 redeem-note issuer-signature note-signature amount bearer to uuid))))
    (ft-transfer? <subnet-token> amount issuer to)))
```

Plain intents work the same way as in v1. `execute` keeps its signature and returns the signer; it now hashes with `bearer: none`.

## Messages

| Signed by | Tuple | Notes |
|---|---|---|
| Issuer (note) | `{contract, intent: "REDEEM_NOTE", opcode: none, amount: some, target: none, bearer: some <33-byte pubkey>, uuid}` | `contract` is the subnet that will call `redeem-note` |
| Note key (claim) | `{contract, claim: uuid, to}` | The tuple shape differs from intents, so a claim can't double as an intent |
| Anyone (intent) | `{contract, intent, opcode, amount, target, bearer: none, uuid}` | As in v1 |

All of them use the SIP-018 header with domain `{name: "BLAZE_PROTOCOL", version: "v2.0", chain-id}`.

## Before this could ship

- v2 subnet contracts that call `.blaze-v2` (subnet balances don't move between versions on their own).
- Routers (`x-multihop-v*`) rebuilt on v2's per-signer replay, with a migration path for open orders.
- Wallet support for signing claims with a note key (a scanner app could do it straight from the QR code).
- The `check` read-only now takes `(signer, uuid)`, so tools that use `check(uuid)` must change.
- An audit. These are draft semantics with unit tests, not a reviewed protocol.
