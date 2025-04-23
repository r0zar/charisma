;; title: welsh-credits-intent
;; authors: rozar.btc
;; summary: Intent-based subnet token wrapper for Welsh Credits using blaze-intent verifier.

;; ---------------------------------------------------------------------------
;; 0. Config - underlying token principal
;; ---------------------------------------------------------------------------
(define-constant TOKEN 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token)
(define-constant BLAZE 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-intent)

;; ---------------------------------------------------------------------------
;; 1. Constants & Errors
;; ---------------------------------------------------------------------------
(define-constant ERR_INSUFFICIENT_BALANCE  (err u400))
(define-constant ERR_UNAUTHORIZED          (err u401))
(define-constant ERR_EXCEEDS_BOUND        (err u402))
;; no additional error codes for now

;; ---------------------------------------------------------------------------
;; 2. Storage
;; ---------------------------------------------------------------------------
(define-map balances principal uint)

;; ---------------------------------------------------------------------------
;; 3. Helpers
;; ---------------------------------------------------------------------------
(define-private (get-balance-internal (who principal))
  (default-to u0 (map-get? balances who))
)

(define-private (do-transfer-internal (from principal) (to principal) (amount uint))
  (if (is-eq from to)
      (ok true)
      (let (
            (from-bal (get-balance-internal from))
            (to-bal   (get-balance-internal to))
           )
        (asserts! (>= from-bal amount) ERR_INSUFFICIENT_BALANCE)
        (map-set balances from (- from-bal amount))
        (map-set balances to   (+ to-bal amount))
        (ok true)
      )
  )
)

;; ---------------------------------------------------------------------------
;; 4. External Token Passthrough (SIP-10)
;; ---------------------------------------------------------------------------
(define-read-only (get-name)         (contract-call? TOKEN get-name))
(define-read-only (get-symbol)       (contract-call? TOKEN get-symbol))
(define-read-only (get-decimals)     (contract-call? TOKEN get-decimals))
(define-read-only (get-token-uri)    (contract-call? TOKEN get-token-uri))
(define-read-only (get-total-supply) (contract-call? TOKEN get-total-supply))

;; ---------------------------------------------------------------------------
;; 5. Balance Read
;; ---------------------------------------------------------------------------
(define-read-only (get-balance (owner principal))
  (ok (get-balance-internal owner))
)

;; ---------------------------------------------------------------------------
;; 6. Deposit / Withdraw / Direct Transfer
;; ---------------------------------------------------------------------------
(define-public (deposit (amount uint) (recipient (optional principal)))
  (let (
        (sender tx-sender)
        (recv (default-to sender recipient))
        (prev-bal (get-balance-internal recv))
       )
    (try! (contract-call? TOKEN transfer amount sender (as-contract tx-sender) none))
    (map-set balances recv (+ prev-bal amount))
    (print {event: "deposit", sender: sender, recipient: recv, amount: amount})
    (ok true)
  )
)

(define-public (withdraw (amount uint) (recipient (optional principal)))
  (let (
        (owner tx-sender)
        (recv (default-to owner recipient))
        (owner-bal (get-balance-internal owner))
       )
    (asserts! (>= owner-bal amount) ERR_INSUFFICIENT_BALANCE)
    (map-set balances owner (- owner-bal amount))
    (try! (as-contract (contract-call? TOKEN transfer amount tx-sender recv none)))
    (print {event: "withdraw", owner: owner, recipient: recv, amount: amount})
    (ok true)
  )
)

(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
  (let ((sender tx-sender))
    (asserts! (is-eq sender from) ERR_UNAUTHORIZED)
    (try! (do-transfer-internal from to amount))
    (print {event: "transfer", from: from, to: to, amount: amount, memo: memo})
    (ok true)
  )
)

;; ---------------------------------------------------------------------------
;; 7. Intent Variants
;; ---------------------------------------------------------------------------

;; 7.a Bearer note redemption (no recipient encoded in signature)
(define-public (x-redeem
    (signature (buff 65))
    (amount    uint)
    (uuid      (string-ascii 36))
    (to        principal)
  )
  (let (
        (intent "REDEEM")
        (signer (try! (contract-call? BLAZE execute 
            signature intent none (some amount) none uuid)))
       )
    (try! (do-transfer-internal signer to amount))
    (print {intent: intent, from: signer, to: to, amount: amount, uuid: uuid})
    (ok true)
  )
)

;; 7.b Exact amount transfer (amount hashed)
(define-public (x-transfer
    (signature (buff 65))
    (amount    uint)
    (uuid      (string-ascii 36))
    (to        principal)
  )
  (let (
        (intent "TRANSFER")
        (signer (try! (contract-call? BLAZE execute 
            signature intent none (some amount) (some to) uuid)))
       )
    (try! (do-transfer-internal signer to amount))
    (print {intent: intent, from: signer, to: to, amount: amount, uuid: uuid})
    (ok true)
  )
)

;; 7.c Upper-bound transfer (amount hashed is bound, actual can be less or equal)
(define-public (x-transfer-lte
    (signature (buff 65))
    (max-amt   uint)                        ;; amount hashed in signature (max)
    (amount    uint)                        ;; amount to transfer (<= max-amt)
    (uuid      (string-ascii 36))
    (to        principal)
  )
  ;; verify amount does not exceed max-amt
  (asserts! (<= amount max-amt) ERR_EXCEEDS_BOUND)
  (let (
        (intent "TRANSFER_LTE")
        (signer (try! (contract-call? BLAZE execute 
            signature intent none (some max-amt) (some to) uuid)))
       )
    (try! (do-transfer-internal signer to amount))
    (print {intent: intent, from: signer, to: to, max-amt: max-amt, amount: amount, uuid: uuid})
    (ok true)
  )
)
