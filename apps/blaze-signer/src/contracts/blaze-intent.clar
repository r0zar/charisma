;; title: blaze
;; author: rozar.btc
;; version: 1.0
;; contributors: @obycode, @LNow_
;; summary: Core SIP-018 verifier + replay-protection that underpins all blaze subnets.
;;   Verifies secp256k1 signatures, prevents UUID re-use, and exposes signer principals
;;   for token subnets, NFTs, and DeFi modules built atop this intent-based protocol.

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;  BLAZE_PROTOCOL • Foundation Contract                                      ;;
;;  ------------------------------------------------------------------------  ;;
;;  Purpose:                                                                  ;;
;;    • Provide a single, immutable verifier & replay-protection layer.       ;;
;;    • Accept off-chain signed "intents" (per SIP-018) from any wallet.      ;;
;;    • Expose a clean `(ok principal)` that downstream contracts can trust.  ;;
;;                                                                            ;;
;;  How to extend:                                                            ;;
;;    1. Call `execute` from your own token / NFT / DeFi contract.            ;;
;;    2. Require callers present a valid signature and message data.          ;;
;;    3. Gate your authorization logic behind that verification result.       ;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-constant structured-data-prefix 0x534950303138)
(define-constant message-domain {name: "BLAZE_PROTOCOL", version: "v1.0", chain-id: chain-id})
(define-constant message-domain-hash (sha256 (unwrap-panic (to-consensus-buff? message-domain))))
(define-constant structured-data-header (concat structured-data-prefix message-domain-hash))

(define-constant ERR_INVALID_SIGNATURE (err u401000))
(define-constant ERR_CONSENSUS_BUFF    (err u422000))
(define-constant ERR_UUID_SUBMITTED    (err u409000))

(define-map submitted-uuids (string-ascii 36) bool)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;  MESSAGE_SCHEMA (fields hashed + signed off-chain)                         ;;
;;                                                                            ;;
;;  IMPORTANT: These values are *raw material* only.  Each subnet contract    ;;
;;  decides how to turn them into on-chain logic.  Understanding this mapping ;;
;;  is how you can off-chain verify messages and use them safely.             ;;
;;                                                                            ;;
;;  • contract — principal of the subnet that will consume the intent.        ;;
;;               Stops cross-contract replay.  Subnet must verify matches.    ;;
;;                                                                            ;;
;;  • intent   — coarse verb, e.g. "TRANSFER_TOKENS", "MINT_NFT", "VOTE".     ;;
;;               Lets wallets sign once and reuse verbs across subnets.       ;;
;;                                                                            ;;
;;  • opcode   — 0-16 byte free-form buffer for flags / selectors / extra     ;;
;;               params.  Think “bit-mask” or “method ID”.  Optional: use     ;;
;;               `none` when unused.                                          ;;
;;                                                                            ;;
;;  • amount   — `uint` payload: quantity, token-ID, upper bound, etc.        ;;
;;               Optional; pass `none` if not relevant to the intent.         ;;
;;                                                                            ;;
;;  • target   — generic principal: recipient, delegate, or secondary         ;;
;;               contract.  Up to the subnet to decide its meaning.           ;;
;;               Optional; use `none` when unused.                            ;;
;;                                                                            ;;
;;  • uuid     — RFC-4122 string nonce.  Stored on-chain to guarantee single  ;;
;;               execution even if the signature is rebroadcast.              ;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(define-read-only (hash
    (contract principal)
    (intent   (string-ascii 32))
    (opcode   (optional (buff 16)))
    (amount   (optional uint))
    (target   (optional principal))
    (uuid     (string-ascii 36))
  )
  (ok (sha256 (concat structured-data-header (sha256 
    (unwrap! (to-consensus-buff? {
      contract: contract, 
      intent: intent, 
      opcode: opcode, 
      amount: amount, 
      target: target, 
      uuid: uuid
    }) ERR_CONSENSUS_BUFF)
  ))))
)

(define-public (execute
    (signature (buff 65))
    (intent    (string-ascii 32))
    (opcode    (optional (buff 16)))
    (amount    (optional uint))
    (target    (optional principal))
    (uuid      (string-ascii 36))
  )
  (if (map-insert submitted-uuids uuid true)
    (verify (try! (hash contract-caller intent opcode amount target uuid)) signature)
    ERR_UUID_SUBMITTED
  )
)

(define-read-only (recover
    (signature (buff 65))
    (contract  principal)
    (intent    (string-ascii 32))
    (opcode    (optional (buff 16)))
    (amount    (optional uint))
    (target    (optional principal))
    (uuid      (string-ascii 36))
  )
  (verify (try! (hash contract intent opcode amount target uuid)) signature)
)

(define-read-only (verify 
    (message   (buff 32)) 
    (signature (buff 65))
  )
  (match (secp256k1-recover? message signature)
    public-key (principal-of? public-key)
    error ERR_INVALID_SIGNATURE
  )
)

(define-read-only (check (uuid (string-ascii 36)))
  (is-some (map-get? submitted-uuids uuid))
)