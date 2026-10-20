;; Title: Hermetica USDh-sUSDh
;; Description: Wraps Hermetica's USDh -> sUSDh staking (staking-v1-1) with the Dexterity interface.
;; Token A = USDh, Token B = sUSDh. One-way: unstaking sUSDh has a cooldown, so B -> A is refused.
;;
;; Hermetica stakes from the calling contract, so the vault takes the USDh, stakes it as itself, and passes the
;; minted sUSDh on. Staking runs at Hermetica's USDh/sUSDh ratio, so trades have no price impact. Quotes read the
;; same ratio.

;; Traits
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)

;; Constants
(define-constant ERR_INVALID_OPERATION (err u400))
(define-constant ERR_STAKING_DISABLED (err u401))
(define-constant ERR_ONE_WAY (err u402))
(define-constant USDH_BASE u100000000)

(define-constant TOKEN-NAME "Hermetica USDh-sUSDh")
(define-constant TOKEN-SYMBOL "USDHSUSDH")
(define-constant TOKEN-URI (some u"https://metadata.charisma.rocks/api/v1/metadata/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.hermetica-usdh-susdh"))

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
        (if (is-eq operation OP_SWAP_B_TO_A) ERR_ONE_WAY
        ERR_INVALID_OPERATION))))

(define-read-only (quote (amount uint) (opcode (optional (buff 16))))
    (let (
        (operation (get-byte opcode u0)))
        (if (is-eq operation OP_SWAP_A_TO_B) (ok {dx: amount, dy: (try! (quote-a-for-b amount)), dk: u0})
        (if (is-eq operation OP_SWAP_B_TO_A) ERR_ONE_WAY
        (if (is-eq operation OP_LOOKUP_RESERVES) (ok (get-reserves))
        ERR_INVALID_OPERATION)))))

;; Execute Functions
(define-private (swap-a-to-b (amount uint))
    (let (
        (sender tx-sender)
        (before (unwrap-panic (contract-call? 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.susdh-token-v1 get-balance current-contract))))
        (try! (contract-call? 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.usdh-token-v1 transfer amount sender current-contract none))
        (try! (as-contract? ((with-ft 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.usdh-token-v1 "usdh" amount))
            (try! (contract-call? 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.staking-v1-1 stake amount none))))
        (let (
            (dy (- (unwrap-panic (contract-call? 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.susdh-token-v1 get-balance current-contract)) before)))
            (try! (as-contract? ((with-ft 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.susdh-token-v1 "susdh" dy))
                (try! (contract-call? 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.susdh-token-v1 transfer dy current-contract sender none))))
            (ok {dx: amount, dy: dy, dk: u0}))))

;; Helper Functions
(define-private (get-byte (opcode (optional (buff 16))) (position uint))
    (default-to 0x00 (element-at? (default-to 0x00 opcode) position)))

;; Quote Functions (mirror stake in staking-v1-1)
(define-read-only (quote-a-for-b (usdh-amount uint))
    (begin
        (asserts! (contract-call? 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.staking-state-v1 get-staking-enabled) ERR_STAKING_DISABLED)
        (asserts! (not (contract-call? 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.susdh-token-v1 get-only-protocol)) ERR_STAKING_DISABLED)
        (ok (/ (* usdh-amount USDH_BASE) (unwrap-panic (contract-call? 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.staking-v1-1 get-usdh-per-susdh))))))

;; What the vault holds: nothing between swaps. Staking mints sUSDh, so no balance limits USDh -> sUSDh.
(define-read-only (get-reserves)
    {
      dx: (unwrap-panic (contract-call? 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.usdh-token-v1 get-balance current-contract)),
      dy: (unwrap-panic (contract-call? 'SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.susdh-token-v1 get-balance current-contract)),
      dk: u0
    })
