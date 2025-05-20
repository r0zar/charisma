;; ---------------------------------------------------------------------------
;;  Hooter Harvest Vault Wrapper
;; ---------------------------------------------------------------------------

(impl-trait .charisma-traits-v1.vault-trait)

;; Constants
(define-constant DEPLOYER tx-sender)
(define-constant CONTRACT (as-contract tx-sender))
(define-constant ERR_INVALID_OPERATION (err u4002))

;; Opcodes
(define-constant OP_SWAP_A_TO_B 0x00)      ;; Swap token A for B
(define-constant OP_SWAP_B_TO_A 0x01)      ;; Swap token B for A
(define-constant OP_ADD_LIQUIDITY 0x02)    ;; Add liquidity
(define-constant OP_REMOVE_LIQUIDITY 0x03) ;; Remove liquidity
(define-constant OP_LOOKUP_RESERVES 0x04)  ;; Read pool reserves

;; Vault Metadata
(define-data-var token-uri (optional (string-utf8 256)) (some u"https://metadata.charisma.rocks/api/v1/metadata/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.md-174769"))
(define-read-only (get-token-uri) (ok (var-get token-uri)))

;; --- Helper Functions ---

(define-private (get-byte (opcode (optional (buff 16))) (position uint))
    (default-to 0x00 (element-at? (default-to 0x00 opcode) position)))

;; --- Core Functions ---

(define-public (execute (amount uint) (opcode (optional (buff 16))))
    (let (
        (op (get-byte opcode u0)))
        (if (is-eq op OP_SWAP_A_TO_B) (claim-tokens amount)
        ERR_INVALID_OPERATION)))

(define-read-only (quote (amount uint) (opcode (optional (buff 16))))
    (let (
        (operation (get-byte opcode u0)))
        (if (is-eq operation OP_SWAP_A_TO_B) (ok (get-swap-quote amount OP_SWAP_A_TO_B))
        (if (is-eq operation OP_SWAP_B_TO_A) (ok {dx: u0, dy: u0, dk: u0})
        (if (is-eq operation OP_LOOKUP_RESERVES) (get-reserves)
        ERR_INVALID_OPERATION)))))

(define-private (claim-tokens (amount uint))
    (contract-call? .hooter-farm-x10 claim amount))

(define-read-only (get-swap-quote (amount uint))
    (contract-call? .hooter-farm-x10 clamp amount))

(define-read-only (get-reserves)
    (ok {dx: (unwrap-panic (contract-call? .energy get-total-supply)), dy: (unwrap-panic (contract-call? .hooter-the-owl get-balance .hooter-farm)), dk: u0}))
