;; Title: StackingDAO stSTX-stSTXbtc
;; Description: Wraps StackingDAO's stSTX <-> stSTXbtc conversion (swap-ststx-ststxbtc-v5) with the Dexterity interface.
;; Token A = stSTX, Token B = stSTXbtc.
;;
;; There is no pool: StackingDAO burns the input from the caller and mints the output to them at its
;; stSTX/STX ratio (1 stSTXbtc = 1 STX), so trades have no price impact. Quotes read the same ratio.

;; Traits
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)

;; Constants
(define-constant ERR_INVALID_OPERATION (err u400))
(define-constant DENOMINATOR_6 u1000000)

(define-constant TOKEN-NAME "StackingDAO stSTX-stSTXbtc")
(define-constant TOKEN-SYMBOL "STSTXSTSTXBTC")
(define-constant TOKEN-URI (some u"https://metadata.charisma.rocks/api/v1/metadata/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stackingdao-ststx-ststxbtc"))

;; Opcodes
(define-constant OP_SWAP_A_TO_B 0x00)       ;; Swap token A for B
(define-constant OP_SWAP_B_TO_A 0x01)       ;; Swap token B for A
(define-constant OP_LOOKUP_RESERVES 0x04)   ;; Read reserves

;; Metadata Functions
(define-read-only (get-name)
    (ok TOKEN-NAME))

(define-read-only (get-symbol)
    (ok TOKEN-SYMBOL))

(define-read-only (get-decimals)
    (ok u6))

(define-read-only (get-token-uri)
    (ok TOKEN-URI))

;; Core Functions
(define-public (execute (amount uint) (opcode (optional (buff 16))))
    (let (
        (operation (get-byte opcode u0)))
        (if (is-eq operation OP_SWAP_A_TO_B) (swap-a-to-b amount)
        (if (is-eq operation OP_SWAP_B_TO_A) (swap-b-to-a amount)
        ERR_INVALID_OPERATION))))

(define-read-only (quote (amount uint) (opcode (optional (buff 16))))
    (let (
        (operation (get-byte opcode u0)))
        (if (is-eq operation OP_SWAP_A_TO_B) (ok {dx: amount, dy: (quote-a-for-b amount), dk: u0})
        (if (is-eq operation OP_SWAP_B_TO_A) (ok {dx: amount, dy: (quote-b-for-a amount), dk: u0})
        (if (is-eq operation OP_LOOKUP_RESERVES) (ok (get-reserves))
        ERR_INVALID_OPERATION)))))

;; Execute Functions
(define-private (swap-a-to-b (amount uint))
    (let (
        (dy (try! (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.swap-ststx-ststxbtc-v5 swap-ststx-for-ststxbtc amount u1))))
        (ok {dx: amount, dy: dy, dk: u0})))

(define-private (swap-b-to-a (amount uint))
    (let (
        (dy (try! (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.swap-ststx-ststxbtc-v5 swap-ststxbtc-for-ststx amount u1))))
        (ok {dx: amount, dy: dy, dk: u0})))

;; Helper Functions
(define-private (get-byte (opcode (optional (buff 16))) (position uint))
    (default-to 0x00 (element-at? (default-to 0x00 opcode) position)))

;; Quote Functions (mirror swap-ststx-ststxbtc-v5)
(define-read-only (quote-a-for-b (ststx-amount uint))
    (/ (* ststx-amount (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.data-stx-v2 get-stx-per-ststx)) DENOMINATOR_6))

(define-read-only (quote-b-for-a (ststxbtc-amount uint))
    (/ (* ststxbtc-amount DENOMINATOR_6) (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.data-stx-v2 get-stx-per-ststx-up)))

;; Output is minted, so either side can be converted in full: report each token's supply
(define-read-only (get-reserves)
    {
      dx: (unwrap-panic (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token get-total-supply)),
      dy: (unwrap-panic (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststxbtc-token-v2 get-total-supply)),
      dk: u0
    })
