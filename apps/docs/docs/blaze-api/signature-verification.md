---
slug: signature-verification
sidebar_position: 6
title: On-Chain Verification (`blaze-v1`)
---

# On-Chain Signature Verification & Replay Protection (`blaze-v1`)

The `blaze-v1` contract is the on-chain authority for verifying signed intents within the Blaze protocol. It ensures two critical properties: authenticity (the intent was signed by the claimed user) and uniqueness (the intent cannot be replayed).

## The `execute` Function

When a subnet contract wants to act on a user's signed intent, it calls the `blaze-v1.execute` public function. This is the primary entry point for verification.

```clarity
(define-public (execute
    (signature (buff 65))           ;; The 65-byte signature from the user
    (intent    (string-ascii 32))    ;; Intent string (e.g., "TRANSFER_TOKENS")
    (opcode    (optional (buff 16)))  ;; Optional opcode
    (amount    (optional uint))        ;; Optional amount
    (target    (optional principal))   ;; Optional target principal
    (uuid      (string-ascii 36))    ;; The unique UUID for this intent
  )
  ;; ... implementation details ...
)
```

**Key Operations within `execute`:**

1.  **Replay Protection**: 
    ```clarity
    (if (map-insert submitted-uuids uuid true)
        ;; ... proceed to verification ...
        ERR_UUID_SUBMITTED
    )
    ```
    The function first attempts to insert the provided `uuid` into the `submitted-uuids` map. 
    *   If `map-insert` returns `true`, it means the UUID was successfully inserted because it wasn't already present. The intent is considered new, and verification proceeds.
    *   If `map-insert` returns `false` (because the key `uuid` already exists), it means this intent has been submitted before. The function immediately returns `ERR_UUID_SUBMITTED` (u409000), preventing replay.

2.  **Hash Reconstruction**: The function reconstructs the 32-byte message hash that the user *should* have signed. It does this by calling its internal `hash` function (detailed in "Intents & Signing") using `contract-caller` as the `contract` parameter for the hash. This is crucial: `blaze-v1` assumes the `contract` part of the signed message is the principal of the contract calling `execute` (i.e., the subnet contract).
    ```clarity
    (try! (hash contract-caller intent opcode amount target uuid))
    ```

3.  **Signature Verification**: The reconstructed hash is then passed to the `verify` function along with the user's `signature`.
    ```clarity
    (verify <reconstructed_hash> signature)
    ```

4.  **Return Value**: If both replay protection and signature verification pass, `execute` returns `(ok signer-principal)`, where `signer-principal` is the Stacks principal corresponding to the public key recovered from the signature. If any step fails, an appropriate error is returned.

## The `verify` Function

This internal read-only function performs the cryptographic signature check:

```clarity
(define-read-only (verify 
    (message   (buff 32))    ;; The 32-byte hash that was supposedly signed
    (signature (buff 65))  ;; The user's secp256k1 signature
  )
  (match (secp256k1-recover? message signature)
    public-key (principal-of? public-key) ;; If recovery is successful, get principal from public key
    error ERR_INVALID_SIGNATURE          ;; If recovery fails
  )
)
```

*   It uses the built-in `secp256k1-recover?` function to attempt to recover the public key from the `message` hash and `signature`.
*   If successful, it converts the recovered `public-key` to a Stacks `principal` using `principal-of?` and returns `(ok recovered-principal)`.
*   If `secp256k1-recover?` fails (e.g., the signature is invalid for the given message hash), it returns `ERR_INVALID_SIGNATURE` (u401000).

## Other Helper Functions

*   `recover`: A read-only version that allows anyone to check a signature against a fully specified intent without attempting to mark the UUID as submitted. Useful for off-chain validation or UI feedback.
*   `check`: A read-only function to see if a `uuid` has already been submitted.

By combining these mechanisms, `blaze-v1` provides a robust foundation for building secure, intent-driven applications on Stacks. 