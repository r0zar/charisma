;; Title: Faktory sBTC-MIA
;; Description: Wraps Faktory's sBTC-MIA pool (mia-pool-faktory) with the Dexterity interface.
;; Token A = sBTC, Token B = MIA.
;; On a sell the pool keeps 0.1% of the sBTC out for Faktory but still reports the full amount,
;; so this wrapper reports what the trader actually receives.

;; Traits
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-traits-v1.sip010-ft-trait)

;; Constants
(define-constant ERR_INVALID_OPERATION (err u400))
(define-constant ERR_UNAUTHORIZED (err u403))
(define-constant PRECISION u1000000)
(define-constant FAKTORY_FEE u1000)

(define-constant TOKEN-NAME "Faktory sBTC-MIA")
(define-constant TOKEN-SYMBOL "SBTCMIA")
(define-constant TOKEN-URI (some u"https://metadata.charisma.rocks/api/v1/metadata/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.faktory-sbtc-mia"))

;; Opcodes
(define-constant OP_SWAP_A_TO_B 0x00)       ;; Swap token A for B
(define-constant OP_SWAP_B_TO_A 0x01)       ;; Swap token B for A
(define-constant OP_LOOKUP_RESERVES 0x04)   ;; Read pool reserves

;; SIP-010 Functions
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-eq tx-sender sender) ERR_UNAUTHORIZED)
        (contract-call? 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.mia-pool-faktory transfer amount sender recipient memo)))

(define-read-only (get-name)
    (ok TOKEN-NAME))

(define-read-only (get-symbol)
    (ok TOKEN-SYMBOL))

(define-read-only (get-decimals)
    (contract-call? 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.mia-pool-faktory get-decimals))

(define-read-only (get-balance (who principal))
    (contract-call? 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.mia-pool-faktory get-balance who))

(define-read-only (get-total-supply)
    (contract-call? 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.mia-pool-faktory get-total-supply))

(define-read-only (get-token-uri)
    (ok TOKEN-URI))

;; Core Functions
(define-public (execute (amount uint) (opcode (optional (buff 16))))
    (let (
        (operation (get-byte opcode u0)))
        (if (is-eq operation OP_SWAP_A_TO_B)
            (let ((delta (try! (contract-call? 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.mia-pool-faktory execute amount (some OP_SWAP_A_TO_B)))))
                (ok {dx: amount, dy: (get dy delta), dk: u0}))
        (if (is-eq operation OP_SWAP_B_TO_A)
            (let ((delta (try! (contract-call? 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.mia-pool-faktory execute amount (some OP_SWAP_B_TO_A)))))
                (ok {dx: amount, dy: (after-fee (get dy delta)), dk: u0}))
        ERR_INVALID_OPERATION))))

(define-read-only (quote (amount uint) (opcode (optional (buff 16))))
    (let (
        (operation (get-byte opcode u0)))
        (if (is-eq operation OP_SWAP_A_TO_B)
            (ok {dx: amount, dy: (get dy (contract-call? 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.mia-pool-faktory get-swap-quote amount (some OP_SWAP_A_TO_B))), dk: u0})
        (if (is-eq operation OP_SWAP_B_TO_A)
            (ok {dx: amount, dy: (after-fee (get dy (contract-call? 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.mia-pool-faktory get-swap-quote amount (some OP_SWAP_B_TO_A)))), dk: u0})
        (if (is-eq operation OP_LOOKUP_RESERVES)
            (contract-call? 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.mia-pool-faktory quote u0 (some OP_LOOKUP_RESERVES))
        ERR_INVALID_OPERATION)))))

;; Helper Functions
(define-private (get-byte (opcode (optional (buff 16))) (position uint))
    (default-to 0x00 (element-at? (default-to 0x00 opcode) position)))

;; The pool's own fee-out math: what reaches the trader on a sell
(define-private (after-fee (dy uint))
    (- dy (/ (* dy FAKTORY_FEE) PRECISION)))
