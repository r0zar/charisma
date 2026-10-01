;; Title: ALEX STX-aBTC
;; Description: Wraps ALEX's STX-aBTC AMM pool (amm-pool-v2-01, pool 45) with the Dexterity interface.
;; Token A = STX (pool x), Token B = aBTC (pool y). Tokens sit in ALEX's shared amm-vault-v2-01.
;;
;; ALEX works in 8-decimal fixed point; its wrapper tokens move the underlying tokens for us.
;; Amounts here are in each token's own decimals and are scaled to and from ALEX's fixed point,
;; rounding down exactly like the wrappers' transfers do. Quotes take the pool fee first, as the swap
;; does, then price the rest with ALEX's read-only get-y-given-x / get-x-given-y.

;; Traits
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)

;; Constants
(define-constant ERR_INVALID_OPERATION (err u400))

(define-constant TOKEN-NAME "ALEX STX-aBTC")
(define-constant TOKEN-SYMBOL "STXABTC")
(define-constant TOKEN-URI (some u"https://metadata.charisma.rocks/api/v1/metadata/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.alex-stx-abtc"))

(define-constant FACTOR u100000000)
;; Multiply a token's own amount by its scale to get ALEX's 8-decimal fixed amount
(define-constant X_SCALE u100)
(define-constant Y_SCALE u1)

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

;; Execute Functions
(define-private (swap-a-to-b (amount uint))
    (let (
        (dy-fixed (try! (contract-call? 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-pool-v2-01 swap-helper
            'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-wstx-v2 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-abtc FACTOR (* amount X_SCALE) none))))
        (ok {dx: amount, dy: (/ dy-fixed Y_SCALE), dk: u0})))

(define-private (swap-b-to-a (amount uint))
    (let (
        (dx-fixed (try! (contract-call? 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-pool-v2-01 swap-helper
            'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-abtc 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-wstx-v2 FACTOR (* amount Y_SCALE) none))))
        (ok {dx: amount, dy: (/ dx-fixed X_SCALE), dk: u0})))

;; Helper Functions
(define-private (get-byte (opcode (optional (buff 16))) (position uint))
    (default-to 0x00 (element-at? (default-to 0x00 opcode) position)))

;; Quote Functions (mirror swap-x-for-y / swap-y-for-x: take the fee, rounded up, then price the rest)
(define-read-only (quote-a-to-b (amount uint))
    (let (
        (pool (get-pool))
        (dx (* amount X_SCALE))
        (dx-net-fees (- dx (mul-up dx (get fee-rate-x pool))))
        (dy (unwrap-panic (contract-call? 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-pool-v2-01 get-y-given-x 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-wstx-v2 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-abtc FACTOR dx-net-fees))))
        ;; The swap refuses to pay above the pool price (ERR-INVALID-LIQUIDITY), so quote nothing then
        (if (<= (div-down dy dx-net-fees) (get-price)) (/ dy Y_SCALE) u0)))

(define-read-only (quote-b-to-a (amount uint))
    (let (
        (pool (get-pool))
        (dy (* amount Y_SCALE))
        (dy-net-fees (- dy (mul-up dy (get fee-rate-y pool))))
        (dx (unwrap-panic (contract-call? 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-pool-v2-01 get-x-given-y 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-wstx-v2 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-abtc FACTOR dy-net-fees))))
        ;; The swap refuses to pay above the pool price (ERR-INVALID-LIQUIDITY), so quote nothing then
        (if (>= (div-down dy-net-fees dx) (get-price)) (/ dx X_SCALE) u0)))

(define-read-only (get-pool)
    (unwrap-panic (contract-call? 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-pool-v2-01 get-pool-details 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-wstx-v2 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-abtc FACTOR)))

(define-read-only (get-price)
    (unwrap-panic (contract-call? 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-pool-v2-01 get-price 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-wstx-v2 'SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK.token-abtc FACTOR)))

;; Same rounding as ALEX's mul-up / div-down (8-decimal fixed point)
(define-private (div-down (a uint) (b uint))
    (if (is-eq a u0) u0 (/ (* a u100000000) b)))

(define-private (mul-up (a uint) (b uint))
    (let ((product (* a b)))
        (if (is-eq product u0) u0 (+ u1 (/ (- product u1) u100000000)))))

(define-read-only (get-reserves)
    (let (
        (pool (get-pool)))
        {
            dx: (/ (get balance-x pool) X_SCALE),
            dy: (/ (get balance-y pool) Y_SCALE),
            dk: (get total-supply pool)
        }))
