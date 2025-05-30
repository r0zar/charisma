;; title: {{TOKEN_NAME}}-subnet
;; author: rozar.btc
;; summary: Intent-based subnet token wrapper for {{TOKEN_NAME}} using blaze-intent verifier.

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-constant ERR_INSUFFICIENT_BALANCE (err u4000))
(define-constant ERR_UNAUTHORIZED         (err u4010))
(define-constant ERR_EXCEEDS_BOUND        (err u4020))

(define-map balances principal uint)

(define-private (balance-of (who principal))
  (default-to u0 (map-get? balances who))
)

(define-private (internal-transfer (from principal) (to principal) (amount uint))
  (if (is-eq from to)
      (ok true)
      (let ((from-bal (balance-of from))
            (to-bal   (balance-of to)))
        (asserts! (>= from-bal amount) ERR_INSUFFICIENT_BALANCE)
        (map-set balances from (- from-bal amount))
        (map-set balances to   (+ to-bal amount))
        (ok true)))
)

;; SIP-10 passthrough helpers
(define-read-only (get-name)         (contract-call? '{{TOKEN_CONTRACT}} get-name))
(define-read-only (get-symbol)       (contract-call? '{{TOKEN_CONTRACT}} get-symbol))
(define-read-only (get-decimals)     (contract-call? '{{TOKEN_CONTRACT}} get-decimals))
(define-read-only (get-token-uri)    (contract-call? '{{TOKEN_CONTRACT}} get-token-uri))
(define-read-only (get-total-supply) (contract-call? '{{TOKEN_CONTRACT}} get-total-supply))

(define-read-only (get-balance (owner principal))
  (ok (balance-of owner))
)

;; SIP-10 transfer
(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
  (let ((sender tx-sender))
    (asserts! (is-eq sender from) ERR_UNAUTHORIZED)
    (try! (internal-transfer from to amount))
    (print {event: "transfer", from: from, to: to, amount: amount, memo: memo})
    (ok true)
  )
)

;; Deposit / Withdraw
(define-public (deposit (amount uint) (recipient (optional principal)))
  (let ((sender tx-sender)
        (recv   (default-to sender recipient))
        (prev   (balance-of recv)))
    (try! (contract-call? '{{TOKEN_CONTRACT}} transfer amount sender (as-contract tx-sender) none))
    (map-set balances recv (+ prev amount))
    (print {event: "deposit", sender: sender, recipient: recv, amount: amount})
    (ok true)))

(define-public (withdraw (amount uint) (recipient (optional principal)))
  (let ((owner tx-sender)
        (recv  (default-to owner recipient))
        (bal   (balance-of owner)))
    (asserts! (>= bal amount) ERR_INSUFFICIENT_BALANCE)
    (map-set balances owner (- bal amount))
    (try! (as-contract (contract-call? '{{TOKEN_CONTRACT}} transfer amount tx-sender recv none)))
    (print {event: "withdraw", owner: owner, recipient: recv, amount: amount})
    (ok true)))

;; Bearer redemption
{{#ENABLE_BEARER}}
(define-public (x-redeem
    (signature (buff 65))
    (amount    uint)
    (uuid      (string-ascii 36))
    (to        principal))
  (let ((signer (try! (contract-call? '{{BLAZE_CONTRACT}} execute signature "REDEEM_BEARER" none (some amount) none uuid))))
    (try! (internal-transfer signer to amount))
    (print {event: "x-redeem", from: signer, to: to, amount: amount, uuid: uuid})
    (ok true)))
{{/ENABLE_BEARER}}

;; Exact transfer
(define-public (x-transfer
    (signature (buff 65))
    (amount uint)
    (uuid   (string-ascii 36))
    (to     principal))
  (let ((signer (try! (contract-call? '{{BLAZE_CONTRACT}} execute signature "TRANSFER_TOKENS" none (some amount) (some to) uuid))))
    (try! (internal-transfer signer to amount))
    (print {event: "x-transfer", from: signer, to: to, amount: amount, uuid: uuid})
    (ok true)))

{{#ENABLE_LTE}}
;; Upper-bound transfer
(define-public (x-transfer-lte
    (signature (buff 65))
    (bound   uint)
    (actual  uint)
    (uuid    (string-ascii 36))
    (to      principal))
  (let ((signer (try! (contract-call? '{{BLAZE_CONTRACT}} execute signature "TRANSFER_TOKENS_LTE" none (some bound) (some to) uuid))))
    (asserts! (<= actual bound) ERR_EXCEEDS_BOUND)
    (try! (internal-transfer signer to actual))
    (print {event: "x-transfer-lte", from: signer, to: to, bound: bound, amount: actual, uuid: uuid})
    (ok true)))
{{/ENABLE_LTE}} 