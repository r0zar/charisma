;; Title: Bitflow sBTC-pBTC
;; Description: Wraps Bitflow's sBTC-pBTC stableswap pool (stableswap-pool-sbtc-pbtc-v-1-1) with the Dexterity interface.
;; Token A = sBTC (pool x-token), Token B = pBTC (pool y-token).
;;
;; Swaps go through stableswap-core-v-1-2. Quotes replay the core's own get-dy / get-dx math
;; (scaling, fees and the curve solver), so a quote matches the swap it predicts.

;; Traits
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)

;; Constants
(define-constant ERR_INVALID_OPERATION (err u400))
(define-constant BPS u10000)

(define-constant TOKEN-NAME "Bitflow sBTC-pBTC")
(define-constant TOKEN-SYMBOL "SBTCPBTC")
(define-constant TOKEN-URI (some u"https://metadata.charisma.rocks/api/v1/metadata/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.bitflow-sbtc-pbtc"))

;; The core scales both sides to the larger token precision (sBTC 8 decimals, pBTC 8 decimals)
(define-constant X_SCALE u1)
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
    (ok u8))

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
        (if (is-eq operation OP_SWAP_A_TO_B) (ok {dx: amount, dy: (quote-x-for-y amount), dk: u0})
        (if (is-eq operation OP_SWAP_B_TO_A) (ok {dx: amount, dy: (quote-y-for-x amount), dk: u0})
        (if (is-eq operation OP_LOOKUP_RESERVES) (ok (get-reserves))
        ERR_INVALID_OPERATION)))))

;; Execute Functions
(define-private (swap-a-to-b (amount uint))
    (let (
        (dy (try! (contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-2 swap-x-for-y 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-sbtc-pbtc-v-1-1 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token 'SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-pBTC amount u1))))
        (ok {dx: amount, dy: dy, dk: u0})))

(define-private (swap-b-to-a (amount uint))
    (let (
        (dx (try! (contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-2 swap-y-for-x 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-sbtc-pbtc-v-1-1 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token 'SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-pBTC amount u1))))
        (ok {dx: amount, dy: dx, dk: u0})))

;; Helper Functions
(define-private (get-byte (opcode (optional (buff 16))) (position uint))
    (default-to 0x00 (element-at? (default-to 0x00 opcode) position)))

;; Quote Functions (mirror get-dy / get-dx in stableswap-core-v-1-2)
(define-read-only (quote-x-for-y (x-amount uint))
    (let (
        (pool (unwrap-panic (contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-sbtc-pbtc-v-1-1 get-pool)))
        (x-balance-scaled (* (get x-balance pool) X_SCALE))
        (y-balance-scaled (* (get y-balance pool) Y_SCALE))
        (x-amount-scaled (* x-amount X_SCALE))
        (x-amount-fees-protocol-scaled (/ (* x-amount-scaled (get x-protocol-fee pool)) BPS))
        (x-amount-fees-provider-scaled (/ (* x-amount-scaled (get x-provider-fee pool)) BPS))
        (dx-scaled (- x-amount-scaled (+ x-amount-fees-protocol-scaled x-amount-fees-provider-scaled)))
        (updated-y-balance-scaled (contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-2 get-y dx-scaled x-balance-scaled y-balance-scaled
            (get amplification-coefficient pool) (get convergence-threshold pool)))
        (updated-y-balance (/ updated-y-balance-scaled Y_SCALE)))
        (- (get y-balance pool) updated-y-balance)))

(define-read-only (quote-y-for-x (y-amount uint))
    (let (
        (pool (unwrap-panic (contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-sbtc-pbtc-v-1-1 get-pool)))
        (x-balance-scaled (* (get x-balance pool) X_SCALE))
        (y-balance-scaled (* (get y-balance pool) Y_SCALE))
        (y-amount-scaled (* y-amount Y_SCALE))
        (y-amount-fees-protocol-scaled (/ (* y-amount-scaled (get y-protocol-fee pool)) BPS))
        (y-amount-fees-provider-scaled (/ (* y-amount-scaled (get y-provider-fee pool)) BPS))
        (dy-scaled (- y-amount-scaled (+ y-amount-fees-protocol-scaled y-amount-fees-provider-scaled)))
        (updated-x-balance-scaled (contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-2 get-x dy-scaled y-balance-scaled x-balance-scaled
            (get amplification-coefficient pool) (get convergence-threshold pool)))
        (updated-x-balance (/ updated-x-balance-scaled X_SCALE)))
        (- (get x-balance pool) updated-x-balance)))

(define-read-only (get-reserves)
    (let (
        (pool (unwrap-panic (contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-sbtc-pbtc-v-1-1 get-pool))))
        {
            dx: (get x-balance pool),
            dy: (get y-balance pool),
            dk: (get total-shares pool)
        }))
