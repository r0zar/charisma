;; title: stable-welsh-usd
;; author: rozar.btc
;; version: 1.0.0
;; summary: Permissionless stable-coin backed by WELSH collateral with SIP-018 subnet intents.
;;          Provides mint, burn, deposit, withdraw and fee-pool accounting.

;; -------- Constants --------
(define-constant CONTRACT (as-contract tx-sender))
(define-constant TOKEN_NAME "STABLE_WELSH_USD")
(define-constant TOKEN_SYMBOL "USDW")
(define-constant MIN_COLLATERAL_PCT u250)           ;; 250 %
(define-constant PRICE_SCALE u1000000)              ;; price fixed-point (6 decimals)
(define-constant ERR_UNAUTHORIZED (err u401))
(define-constant ERR_INSUFFICIENT_BALANCE (err u402))
(define-constant ERR_COLLATERAL_RATIO (err u403))
(define-constant FEE_DEN u100)  ;; divisor for 1 % fee calculations

;; -------- Storage --------
;; WELSH collateral balances per provider
(define-map collateral-balances principal uint)

;; Fee pools
(define-data-var token-fee-pool   uint u0)   ;; WELSH fees awaiting distribution
(define-data-var token-fees-total uint u0)   ;; all-time aggregated WELSH fees
(define-data-var usd-fee-pool     uint u0)   ;; USD fees (cents) awaiting conversion
(define-data-var usd-fees-total   uint u0)   ;; all-time aggregated USD fees

;; -------- Helper: internal collateral balance --------
(define-private (coll-of (who principal))
  (default-to u0 (map-get? collateral-balances who)))

;; -------- Collateral helper views --------
(define-read-only (get-collateral (who principal))      (ok (coll-of who)))
(define-read-only (get-total-collateral)                (ok (ft-get-balance .x-welshcorgicoin-token CONTRACT)))
(define-read-only (get-token-fee-pool)                  (ok (var-get token-fee-pool)))
(define-read-only (get-usd-fee-pool)                    (ok (var-get usd-fee-pool)))

;; -------- Public collateral functions --------
(define-public (deposit (amount-welsh uint) (recipient (optional principal)))
  (let ((recv (default-to tx-sender recipient)))
    (try! (contract-call? .x-welshcorgicoin-token transfer amount-welsh tx-sender CONTRACT none))
    (map-set collateral-balances recv (+ amount-welsh (coll-of recv)))
    (ok true)))

(define-public (withdraw (amount-welsh uint) (recipient (optional principal)))
  (let ((owner tx-sender)
        (recv  (default-to owner recipient)))
    (asserts! (>= (coll-of owner) amount-welsh) ERR_INSUFFICIENT_BALANCE)
    ;; Collateral ratio enforcement is handled off-chain by solver.
    (map-set collateral-balances owner (- (coll-of owner) amount-welsh))
    (try! (as-contract (contract-call? .x-welshcorgicoin-token transfer amount-welsh CONTRACT recv none)))
    (ok true)))

;; -------- Subnet mint (intent-based) --------
(define-public (x-mint
    (usd-cents uint)
    (signature (buff 65))
    (collateral-welsh uint)
    (bound-welsh uint)
    (uuid (string-ascii 36))
    (recipient principal))
  ;; Helper – ceil division by 100 for 1 % fee
  (let ((fee-tokens (ceil-div collateral-welsh FEE_DEN)))
    (let ((total-tokens (+ collateral-welsh fee-tokens)))
      (asserts! (<= total-tokens bound-welsh) ERR_INSUFFICIENT_BALANCE)
      ;; Pull tokens from signer (total = collateral + fee)
      (try! (contract-call? .x-welshcorgicoin-token x-transfer-lte signature bound-welsh total-tokens uuid CONTRACT))
      ;; Credit collateral to vault balance of signer
      (map-set collateral-balances recipient (+ collateral-welsh (coll-of recipient)))
      ;; Fee pool accounting
      (var-set token-fee-pool (+ (var-get token-fee-pool) fee-tokens))
      (var-set token-fees-total (+ (var-get token-fees-total) fee-tokens))
      ;; Mint USD stablecoins to recipient via external contract implementing ft-plus-trait
      (try! (contract-call? .stable-welsh-usd-token mint usd-cents recipient))
      (ok {minted: usd-cents, collateral: collateral-welsh, fee-tokens: fee-tokens}))))

;; -------- Subnet burn (intent-based) --------
(define-public (x-burn
    (usd-cents uint)
    (tokens-release uint)
    (signature (buff 65))
    (uuid (string-ascii 36))
    (recipient principal))
  (let ((signer (try! (contract-call? .blaze execute signature "BURN_TOKENS" none (some usd-cents) (some recipient) uuid))))
    (let ((fee-cents (ceil-div usd-cents FEE_DEN))
          (total-burn (+ usd-cents (ceil-div usd-cents FEE_DEN))))
      ;; Burn USD stablecoins (+ fee) from signer in external token contract
      (try! (contract-call? .stable-welsh-usd-token burn total-burn signer))
      ;; Accumulate USD fee pool
      (var-set usd-fee-pool (+ (var-get usd-fee-pool) fee-cents))
      (var-set usd-fees-total (+ (var-get usd-fees-total) fee-cents))
      ;; Release collateral tokens to recipient
      (try! (as-contract (contract-call? .x-welshcorgicoin-token transfer tokens-release CONTRACT recipient none)))
      ;; Decrease collateral balance of signer proportionally
      (let ((prev (coll-of signer)))
        (map-set collateral-balances signer (if (> prev tokens-release) (- prev tokens-release) u0)))
      (ok {burned: usd-cents, fee-cents: fee-cents, tokens-released: tokens-release}))))

;; -------- Private helpers --------
(define-private (ceil-div (numerator uint) (denominator uint))
  (/ (+ numerator (- denominator u1)) denominator))