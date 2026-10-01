;; Title: Arkadiko STX-USDA
;; Description: Wraps Arkadiko's STX-USDA pair (arkadiko-swap-v2-1) with the Dexterity interface.
;; Token A = STX (pair x), Token B = USDA (pair y). Tokens sit in arkadiko-swap-v2-1.
;; Arkadiko swaps STX through its wrapped-stx-token: it takes your STX and mints/burns wSTX for you,
;; so callers pay and receive plain STX.
;;
;; Quotes replay swap-x-for-y / swap-y-for-x exactly: a 0.3% fee on the input, then x*y=k
;; on the pair's recorded balances.

;; Traits
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)

;; Constants
(define-constant ERR_INVALID_OPERATION (err u400))

(define-constant TOKEN-NAME "Arkadiko STX-USDA")
(define-constant TOKEN-SYMBOL "STXUSDA")
(define-constant TOKEN-URI (some u"https://metadata.charisma.rocks/api/v1/metadata/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.arkadiko-stx-usda"))

;; Opcodes
(define-constant OP_SWAP_A_TO_B 0x00)       ;; Swap token A for B
(define-constant OP_SWAP_B_TO_A 0x01)       ;; Swap token B for A
(define-constant OP_LOOKUP_RESERVES 0x04)   ;; Read pool reserves

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
        (if (is-eq operation OP_SWAP_A_TO_B) (ok {dx: amount, dy: (quote-a-to-b amount), dk: u0})
        (if (is-eq operation OP_SWAP_B_TO_A) (ok {dx: amount, dy: (quote-b-to-a amount), dk: u0})
        (if (is-eq operation OP_LOOKUP_RESERVES) (ok (get-reserves))
        ERR_INVALID_OPERATION)))))

;; Execute Functions (Arkadiko returns (list dx dy))
(define-private (swap-a-to-b (amount uint))
    (let (
        (result (try! (contract-call? 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-v2-1 swap-x-for-y 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.wrapped-stx-token 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token amount u0))))
        (ok {dx: amount, dy: (unwrap-panic (element-at? result u1)), dk: u0})))

(define-private (swap-b-to-a (amount uint))
    (let (
        (result (try! (contract-call? 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-v2-1 swap-y-for-x 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.wrapped-stx-token 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token amount u0))))
        (ok {dx: amount, dy: (unwrap-panic (element-at? result u0)), dk: u0})))

;; Helper Functions
(define-private (get-byte (opcode (optional (buff 16))) (position uint))
    (default-to 0x00 (element-at? (default-to 0x00 opcode) position)))

(define-read-only (get-pair)
    (unwrap-panic (unwrap-panic (contract-call? 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-swap-v2-1 get-pair-details 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.wrapped-stx-token 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token))))

;; Quote Functions
(define-read-only (quote-a-to-b (dx uint))
    (let (
        (pair (get-pair))
        (dx-with-fees (/ (* u997 dx) u1000)))
        (/ (* (get balance-y pair) dx-with-fees) (+ (get balance-x pair) dx-with-fees))))

(define-read-only (quote-b-to-a (dy uint))
    (let (
        (pair (get-pair))
        (dy-with-fees (/ (* u997 dy) u1000)))
        (/ (* (get balance-x pair) dy-with-fees) (+ (get balance-y pair) dy-with-fees))))

(define-read-only (get-reserves)
    (let (
        (pair (get-pair)))
        {
            dx: (get balance-x pair),
            dy: (get balance-y pair),
            dk: (get shares-total pair)
        }))
