;; Dexterity adapter for Zest Stacks Swap: one adapter for every Charisma (Dexterity) pool.
;; The router passes the pool. x-for-y picks its opcode: true = 0x00 (token A for token B), false = 0x01.
;; Stateless: it holds nothing between swaps, and only the input it was just handed can leave it.

(use-trait ft-trait 'SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST.sip010-trait.sip010-trait)
(use-trait dexterity-pool 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)
(impl-trait .swap-trait-dexterity.swap-trait-dexterity)

(define-constant OP_A_TO_B 0x00)
(define-constant OP_B_TO_A 0x01)
(define-constant ERR_ZERO (err u501))
(define-constant ERR_MIN_OUT (err u502))
(define-constant ERR_RESIDUAL (err u504))

(define-private (bal (token <ft-trait>) (is-stx bool))
  (if is-stx (ok (stx-get-balance current-contract)) (contract-call? token get-balance current-contract)))

(define-private (pull (token <ft-trait>) (is-stx bool) (amount uint))
  (if is-stx
    (stx-transfer? amount tx-sender current-contract)
    (contract-call? token transfer amount tx-sender current-contract none)))

(define-private (pool-swap (pool <dexterity-pool>) (token-in <ft-trait>) (is-stx-in bool) (amount uint) (opcode (buff 1)))
  (if is-stx-in
    (as-contract? ((with-stx amount))
      (try! (contract-call? pool execute amount (some opcode))))
    (as-contract? ((with-ft (contract-of token-in) "*" amount))
      (try! (contract-call? pool execute amount (some opcode))))))

(define-private (forward-out (token-out <ft-trait>) (is-stx-out bool) (out uint) (recipient principal))
  (if is-stx-out
    (as-contract? ((with-stx out))
      (try! (stx-transfer? out tx-sender recipient)))
    (as-contract? ((with-ft (contract-of token-out) "*" out))
      (try! (contract-call? token-out transfer out tx-sender recipient none)))))

(define-public (swap-leg
  (pool <dexterity-pool>) (x-for-y bool) (is-stx-in bool) (is-stx-out bool)
  (token-in <ft-trait>) (token-out <ft-trait>) (amount-in uint) (min-out uint))
  (let ((caller contract-caller)
        (before-in (try! (bal token-in is-stx-in)))
        (before-out (try! (bal token-out is-stx-out))))
    (asserts! (> amount-in u0) ERR_ZERO)
    (try! (pull token-in is-stx-in amount-in))
    (try! (pool-swap pool token-in is-stx-in amount-in (if x-for-y OP_A_TO_B OP_B_TO_A)))
    (asserts! (is-eq (try! (bal token-in is-stx-in)) before-in) ERR_RESIDUAL)
    (let ((out (- (try! (bal token-out is-stx-out)) before-out)))
      (asserts! (>= out min-out) ERR_MIN_OUT)
      (try! (forward-out token-out is-stx-out out caller))
      (ok out))))
