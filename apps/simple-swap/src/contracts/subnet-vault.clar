;; title: vault-subnet-wrapper
;; authors: rozar.btc
;; summary: Subnet wrapper for LP vault operations using blaze signatures

;; STILL WIP

;; ---------------------------------------------------------------------------
;; 1. Traits and Constants
;; ---------------------------------------------------------------------------
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-traits-v1.sip010-ft-trait)
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)

;; Constants
(define-constant DEPLOYER tx-sender)
(define-constant CONTRACT (as-contract tx-sender))
(define-constant ERR_UNAUTHORIZED (err u403))
(define-constant ERR_INSUFFICIENT_BALANCE (err u401))
(define-constant ERR_INVALID_OPERATION (err u400))
(define-constant PRECISION u1000000)
(define-constant LP_REBATE u50000)

;; ---------------------------------------------------------------------------
;; 2. Storage - Track only LP balances
;; ---------------------------------------------------------------------------
(define-map lp-balances principal uint)

;; ---------------------------------------------------------------------------
;; 3. SIP-010 Implementation for LP token
;; ---------------------------------------------------------------------------
(define-read-only (get-name) (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.we-are-legion get-name))
(define-read-only (get-symbol) (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.we-are-legion get-symbol))
(define-read-only (get-decimals) (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.we-are-legion get-decimals))
(define-read-only (get-token-uri) (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.we-are-legion get-token-uri))
(define-read-only (get-total-supply) (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.we-are-legion get-total-supply))

(define-read-only (get-balance (owner principal))
  (ok (default-to u0 (map-get? lp-balances owner)))
)

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (let ((sender-balance (default-to u0 (map-get? lp-balances sender))))
    (asserts! (is-eq tx-sender sender) ERR_UNAUTHORIZED)
    (asserts! (>= sender-balance amount) ERR_INSUFFICIENT_BALANCE)
    (map-set lp-balances sender (- sender-balance amount))
    (map-set lp-balances recipient (+ (default-to u0 (map-get? lp-balances recipient)) amount))
    (print {event: "transfer", sender: sender, recipient: recipient, amount: amount, memo: memo})
    (ok true)
  )
)

;; ---------------------------------------------------------------------------
;; 4. LP Token Deposit & Withdraw
;; ---------------------------------------------------------------------------
(define-public (deposit (amount uint))
  (let ((sender tx-sender))
    (try! (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.we-are-legion transfer amount sender CONTRACT none))
    (map-set lp-balances sender (+ (default-to u0 (map-get? lp-balances sender)) amount))
    (print {event: "deposit", sender: sender, amount: amount})
    (ok true)
  )
)

(define-public (withdraw (amount uint))
  (let ((sender tx-sender)
        (sender-balance (default-to u0 (map-get? lp-balances sender))))
    (asserts! (>= sender-balance amount) ERR_INSUFFICIENT_BALANCE)
    (map-set lp-balances sender (- sender-balance amount))
    (try! (as-contract (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.we-are-legion transfer amount tx-sender sender none)))
    (print {event: "withdraw", sender: sender, amount: amount})
    (ok true)
  )
)

;; ---------------------------------------------------------------------------
;; 5. Swap Quote Logic
;; ---------------------------------------------------------------------------
;; Get reserves from underlying contract
(define-read-only (get-reserves)
  { 
    a: (unwrap-panic (contract-call? 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welsh-credits-rc6 get-balance CONTRACT)), 
    b: (unwrap-panic (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-credits-rc1 get-balance CONTRACT))
  }
)

;; Calculate swap quote (reimplemented from vault.clar)
(define-read-only (get-swap-quote (amount uint) (is-a-to-b bool))
  (let (
      (reserves (get-reserves))
      (x (if is-a-to-b (get a reserves) (get b reserves)))
      (y (if is-a-to-b (get b reserves) (get a reserves)))
      (dx (/ (* amount (- PRECISION LP_REBATE)) PRECISION))
      (numerator (* dx y))
      (denominator (+ x dx))
      (dy (/ numerator denominator)))
      {
        dx: dx,
        dy: dy,
        dk: u0
      }
  )
)

;; Calculate liquidity quote (reimplemented from vault.clar)
(define-read-only (get-liquidity-quote (amount uint))
  (let (
      (k (unwrap-panic (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.we-are-legion get-total-supply)))
      (reserves (get-reserves)))
      {
        dx: (if (> k u0) (/ (* amount (get a reserves)) k) amount),
        dy: (if (> k u0) (/ (* amount (get b reserves)) k) amount),
        dk: amount
      }
  )
)

;; ---------------------------------------------------------------------------
;; 6. Pool Interface Implementation
;; ---------------------------------------------------------------------------
(define-read-only (quote (amount uint) (opcode (optional (buff 16))))
  (let ((operation (default-to 0x00 (element-at? (default-to 0x00 opcode) u0))))
    (if (is-eq operation 0x00) (ok (get-swap-quote amount true))
    (if (is-eq operation 0x01) (ok (get-swap-quote amount false))
    (if (is-eq operation 0x02) (ok (get-liquidity-quote amount))
    (if (is-eq operation 0x03) (ok (get-liquidity-quote amount))
    ERR_INVALID_OPERATION)))))
)

;; Signed execute function
(define-public (signed-execute 
    (signature (buff 65))
    (amount uint)
    (uuid (string-ascii 36))
    (recipient principal)
    (opcode (optional (buff 16)))
  )
  (let (
        (operation (default-to 0x00 (element-at? (default-to 0x00 opcode) u0)))
       )
    (if (is-eq operation 0x00) 
        (redeem-swap-a-to-b signature amount uuid recipient)
    (if (is-eq operation 0x01) 
        (redeem-swap-b-to-a signature amount uuid recipient)
    (if (is-eq operation 0x02) 
        (redeem-add-liquidity signature amount uuid recipient)
    (if (is-eq operation 0x03) 
        (redeem-remove-liquidity signature amount uuid recipient)
    ERR_INVALID_OPERATION))))
  )
)

;; ---------------------------------------------------------------------------
;; 7. Redeem note functions for operations
;; ---------------------------------------------------------------------------
;; Redeem swap A to B
(define-public (redeem-swap-a-to-b
    (signature (buff 65))
    (amount uint)
    (uuid (string-ascii 36))
    (recipient principal)
  )
  (let (
        (opcode "SWAP_A_TO_B")
        ;; Verify the signer using get-signer-from-args with correct principal
        (signer (try! (contract-call?
                     'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-rc9
                     get-signer-from-args signature CONTRACT opcode uuid)))
        ;; Get quote for the swap
        (delta (get-swap-quote amount true))
        (dy (get dy delta))
       )
    ;; Future enhancement: Add deadline check to prevent stale transactions
    ;; (asserts! (< block-height deadline) (err u408))
    
    ;; Future enhancement: Add minimum output check to protect against slippage
    ;; (asserts! (>= dy min-dy) (err u409))
    
    ;; Call redeem-note on 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welsh-credits-rc6 to transfer funds from signer to us
    (try! (contract-call? 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welsh-credits-rc6 redeem-note 
           signature amount uuid CONTRACT))
    
    ;; Call regular transfer on 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-credits-rc1 to credit the recipient
    (try! (as-contract (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-credits-rc1 transfer 
           dy tx-sender recipient none)))
    
    (print {event: "redeem-swap-a-to-b", signer: signer, recipient: recipient, amount-in: amount, amount-out: dy, uuid: uuid})
    (ok delta)
  )
)

;; Redeem swap B to A
(define-public (redeem-swap-b-to-a
    (signature (buff 65))
    (amount uint)
    (uuid (string-ascii 36))
    (recipient principal)
  )
  (let (
        (opcode "SWAP_B_TO_A")
        ;; Verify the signer using get-signer-from-args with correct principal
        (signer (try! (contract-call?
                     'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-rc9
                     get-signer-from-args signature CONTRACT opcode uuid)))
        ;; Get quote for the swap
        (delta (get-swap-quote amount false))
        (dy (get dy delta))
       )
    ;; Future enhancement: Add deadline check to prevent stale transactions
    ;; (asserts! (< block-height deadline) (err u408))
    
    ;; Future enhancement: Add minimum output check to protect against slippage
    ;; (asserts! (>= dy min-dy) (err u409))
    
    ;; Call redeem-note on 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-credits-rc1 to transfer funds from signer to us
    (try! (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-credits-rc1 redeem-note 
           signature amount uuid CONTRACT))
    
    ;; Call regular transfer on 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welsh-credits-rc6 to credit the recipient
    (try! (as-contract (contract-call? 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welsh-credits-rc6 transfer 
           dy tx-sender recipient none)))
    
    (print {event: "redeem-swap-b-to-a", signer: signer, recipient: recipient, amount-in: amount, amount-out: dy, uuid: uuid})
    (ok delta)
  )
)

;; Redeem add liquidity
(define-public (redeem-add-liquidity
    (signature (buff 65))
    (amount uint)
    (uuid (string-ascii 36))
    (recipient principal)
  )
  (let (
        (opcode "ADD_LIQUIDITY")
        ;; Verify the signer using get-signer-from-args with correct principal
        (signer (try! (contract-call?
                     'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-rc9
                     get-signer-from-args signature CONTRACT opcode uuid)))
        ;; Get quote for adding liquidity
        (delta (get-liquidity-quote amount))
        (dx (get dx delta))
        (dy (get dy delta))
        (dk (get dk delta))
       )
    ;; Future enhancement: Add deadline check to prevent stale transactions
    ;; (asserts! (< block-height deadline) (err u408))
    
    ;; Call redeem-note on 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welsh-credits-rc6 to transfer token A from signer to us
    (try! (contract-call? 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welsh-credits-rc6 redeem-note 
           signature dx uuid CONTRACT))
    
    ;; Call redeem-note on 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-credits-rc1 to transfer token B from signer to us
    (try! (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-credits-rc1 redeem-note 
           signature dy uuid CONTRACT))
    
    ;; Credit LP tokens to recipient in the wrapper
    (map-set lp-balances recipient (+ (default-to u0 (map-get? lp-balances recipient)) dk))
    
    (print {event: "redeem-add-liquidity", signer: signer, recipient: recipient, token-a: dx, token-b: dy, lp-amount: dk, uuid: uuid})
    (ok delta)
  )
)

;; Redeem remove liquidity
(define-public (redeem-remove-liquidity
    (signature (buff 65))
    (amount uint)
    (uuid (string-ascii 36))
    (recipient principal)
  )
  (let (
        (opcode "REMOVE_LIQUIDITY")
        ;; Verify the signer using get-signer-from-args with correct principal
        (signer (try! (contract-call?
                     'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-rc9
                     get-signer-from-args signature CONTRACT opcode uuid)))
        ;; Get quote for removing liquidity
        (delta (get-liquidity-quote amount))
        (dx (get dx delta))
        (dy (get dy delta))
        (dk (get dk delta))
        (signer-lp-balance (default-to u0 (map-get? lp-balances signer)))
       )
    ;; Future enhancement: Add deadline check to prevent stale transactions
    ;; (asserts! (< block-height deadline) (err u408))
    
    ;; Check if signer has enough LP tokens in this wrapper
    (asserts! (>= signer-lp-balance dk) ERR_INSUFFICIENT_BALANCE)
    
    ;; Burn LP tokens from signer in the wrapper
    (map-set lp-balances signer (- signer-lp-balance dk))
    
    ;; Call regular transfer on 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welsh-credits-rc6 to credit the recipient with token A
    (try! (as-contract (contract-call? 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welsh-credits-rc6 transfer 
           dx tx-sender recipient none)))
    
    ;; Call regular transfer on 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-credits-rc1 to credit the recipient with token B
    (try! (as-contract (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-credits-rc1 transfer 
           dy tx-sender recipient none)))
    
    (print {event: "redeem-remove-liquidity", signer: signer, recipient: recipient, lp-amount: dk, token-a: dx, token-b: dy, uuid: uuid})
    (ok delta)
  )
)