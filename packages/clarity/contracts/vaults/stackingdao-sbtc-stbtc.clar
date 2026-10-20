;; Title: StackingDAO sBTC-stBTC
;; Description: Wraps StackingDAO's sBTC <-> stBTC conversion (stacking-dao-core-stbtc-v1) with the Dexterity interface.
;; Token A = sBTC, Token B = stBTC.
;;
;; sBTC -> stBTC deposits sBTC into stbtc-reserve and mints stBTC to the caller.
;; stBTC -> sBTC burns stBTC and pays sBTC from the reserve's idle balance, minus StackingDAO's idle-withdraw fee.
;; Both run at StackingDAO's sBTC/stBTC ratio, so trades have no price impact. Quotes read the same ratio.

;; Traits
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)

;; Constants
(define-constant ERR_INVALID_OPERATION (err u400))
(define-constant ERR_SHUTDOWN (err u401))
(define-constant ERR_INSUFFICIENT_IDLE (err u402))
(define-constant DENOMINATOR_8 u100000000)
(define-constant DENOMINATOR_BPS u10000)

(define-constant TOKEN-NAME "StackingDAO sBTC-stBTC")
(define-constant TOKEN-SYMBOL "SBTCSTBTC")
(define-constant TOKEN-URI (some u"https://metadata.charisma.rocks/api/v1/metadata/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stackingdao-sbtc-stbtc"))

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
        (if (is-eq operation OP_SWAP_A_TO_B) (ok {dx: amount, dy: (try! (quote-a-for-b amount)), dk: u0})
        (if (is-eq operation OP_SWAP_B_TO_A) (ok {dx: amount, dy: (try! (quote-b-for-a amount)), dk: u0})
        (if (is-eq operation OP_LOOKUP_RESERVES) (ok (get-reserves))
        ERR_INVALID_OPERATION)))))

;; Execute Functions
(define-private (swap-a-to-b (amount uint))
    (let (
        (dy (try! (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-stbtc-v1 deposit amount u1))))
        (ok {dx: amount, dy: dy, dk: u0})))

(define-private (swap-b-to-a (amount uint))
    (let (
        (paid (try! (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-stbtc-v1 withdraw-idle amount))))
        (ok {dx: amount, dy: (get sbtc-user paid), dk: u0})))

;; Helper Functions
(define-private (get-byte (opcode (optional (buff 16))) (position uint))
    (default-to 0x00 (element-at? (default-to 0x00 opcode) position)))

(define-read-only (get-idle-sbtc)
    (let (
        (idle (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stbtc-reserve get-sbtc-balance))
        (reserved (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stbtc-reserve get-sbtc-for-withdrawals)))
        (if (> idle reserved) (- idle reserved) u0)))

;; Quote Functions (mirror deposit / withdraw-idle in stacking-dao-core-stbtc-v1)
(define-read-only (quote-a-for-b (sbtc-amount uint))
    (begin
        (asserts! (not (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-stbtc-v1 get-shutdown-deposits)) ERR_SHUTDOWN)
        (ok (/ (* sbtc-amount DENOMINATOR_8) (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.data-stbtc-v1 get-sbtc-per-stbtc-up)))))

(define-read-only (quote-b-for-a (stbtc-amount uint))
    (let (
        (sbtc-amount (/ (* stbtc-amount (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.data-stbtc-v1 get-sbtc-per-stbtc)) DENOMINATOR_8))
        (sbtc-fee (if (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-stbtc-v1 is-fee-exempt tx-sender)
            u0
            (/ (* (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-stbtc-v1 get-withdraw-idle-fee) sbtc-amount) DENOMINATOR_BPS)))
        (sbtc-user (- sbtc-amount sbtc-fee)))
        (asserts! (not (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stacking-dao-core-stbtc-v1 get-shutdown-withdraw-idle)) ERR_SHUTDOWN)
        (asserts! (>= (get-idle-sbtc) sbtc-user) ERR_INSUFFICIENT_IDLE)
        (ok sbtc-user)))

;; A = idle sBTC that stBTC -> sBTC can pay out; B = stBTC supply (sBTC -> stBTC mints, so it is not a limit)
(define-read-only (get-reserves)
    {
      dx: (get-idle-sbtc),
      dy: (unwrap-panic (contract-call? 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stbtc-token get-total-supply)),
      dk: u0
    })
