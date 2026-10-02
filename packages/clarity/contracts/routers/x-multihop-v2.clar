;; Title: Multi-hop Router
;; Version: 2.0.0 (x-multihop-v2)
;; Description:
;;   Router contract for executing multi-hop swaps across liquidity pools
;;   that implements the vault interface for subnet compatibility.
;;   Same as x-multihop-v1 (the output always goes to the person who signed), for subnets on either Blaze version:
;;   the signer is recovered with blaze-v2 or blaze-v1, and out.to must match one of them. The subnet's own x-transfer
;;   then checks the signature again under its own version, so a signature can only ever move its own signer's funds.

;; Constants

(define-constant CONTRACT (as-contract tx-sender))
(define-constant ERR_NOT_SIGNER (err u403))


;; Traits

(define-trait subnet-trait (
  (x-transfer 
    ((buff 65) uint (string-ascii 36) principal) 
    (response bool uint))))

(define-trait vault-trait (
  (execute 
    (uint (optional (buff 16))) 
    (response (tuple (dx uint) (dy uint) (dk uint)) uint))))

(define-trait sip10-trait (
  (transfer 
    (uint principal principal (optional (buff 34))) 
    (response bool uint))))

;; Utilities

(define-private (check-recipient (in {token: <subnet-trait>, amount: uint, signature: (buff 65), uuid: (string-ascii 36)}) (out {token: <sip10-trait>, to: principal}))
  (let ((t (get token in)) (s (get signature in)) (a (some (get amount in))) (u (get uuid in)) (to (ok (get to out))))
  (asserts! (or (is-eq (contract-call? .blaze-v2 recover s (contract-of t) "TRANSFER_TOKENS" none a (some CONTRACT) u) to)
                (is-eq (contract-call? .blaze-v1 recover s (contract-of t) "TRANSFER_TOKENS" none a (some CONTRACT) u) to))
    ERR_NOT_SIGNER)
  (ok true)))


(define-private (x-deposit (in {token: <subnet-trait>, amount: uint, signature: (buff 65), uuid: (string-ascii 36)}))
  (let ((t (get token in)) (a (get amount in)) (s (get signature in)) (u (get uuid in))
  (r (unwrap-panic (contract-call? t x-transfer s a u CONTRACT))))
  (print {type: "x-deposit", token: t, amount: a, signature: s, uuid: u, result: r}) r))

(define-private (execute (operation {vault: <vault-trait>, opcode: (buff 16)}) (amount uint))
  (let ((v (get vault operation)) (o (get opcode operation))
  (r (unwrap-panic (as-contract (contract-call? v execute amount (some o))))))
  (print {type: "execute", vault: v, opcode: o, amount: amount, result: r}) r))

(define-private (withdraw (out {token: <sip10-trait>, to: principal}) (amount uint))
  (let ((o (get token out)) (t (get to out))
  (r (unwrap-panic (as-contract (contract-call? o transfer amount CONTRACT t none)))))
  (print {type: "withdraw", token: o, to: t, amount: amount, result: r}) r))


;; Functions

(define-public (x-swap-1
    (in {token: <subnet-trait>, amount: uint, signature: (buff 65), uuid: (string-ascii 36)})
    (hop-1 {vault: <vault-trait>, opcode: (buff 16)})
    (out {token: <sip10-trait>, to: principal}))
  (let (
    (r-c (try! (check-recipient in out)))
    (r-i (x-deposit in))
    (r-1 (execute hop-1 (get amount in)))
    (r-w (withdraw out (get dy r-1))))
    (ok (list r-1))))

(define-public (x-swap-2
    (in {token: <subnet-trait>, amount: uint, signature: (buff 65), uuid: (string-ascii 36)})
    (hop-1 {vault: <vault-trait>, opcode: (buff 16)})
    (hop-2 {vault: <vault-trait>, opcode: (buff 16)})
    (out {token: <sip10-trait>, to: principal}))
  (let (
    (r-c (try! (check-recipient in out)))
    (r-i (x-deposit in))
    (r-1 (execute hop-1 (get amount in)))
    (r-2 (execute hop-2 (get dy r-1)))
    (r-w (withdraw out (get dy r-2))))
    (ok (list r-1 r-2))))

(define-public (x-swap-3
    (in {token: <subnet-trait>, amount: uint, signature: (buff 65), uuid: (string-ascii 36)})
    (hop-1 {vault: <vault-trait>, opcode: (buff 16)})
    (hop-2 {vault: <vault-trait>, opcode: (buff 16)})
    (hop-3 {vault: <vault-trait>, opcode: (buff 16)})
    (out {token: <sip10-trait>, to: principal}))
  (let (
    (r-c (try! (check-recipient in out)))
    (r-i (x-deposit in))
    (r-1 (execute hop-1 (get amount in)))
    (r-2 (execute hop-2 (get dy r-1)))
    (r-3 (execute hop-3 (get dy r-2)))
    (r-w (withdraw out (get dy r-3))))
    (ok (list r-1 r-2 r-3))))

(define-public (x-swap-4
    (in {token: <subnet-trait>, amount: uint, signature: (buff 65), uuid: (string-ascii 36)})
    (hop-1 {vault: <vault-trait>, opcode: (buff 16)})
    (hop-2 {vault: <vault-trait>, opcode: (buff 16)})
    (hop-3 {vault: <vault-trait>, opcode: (buff 16)})
    (hop-4 {vault: <vault-trait>, opcode: (buff 16)})
    (out {token: <sip10-trait>, to: principal}))
  (let (
    (r-c (try! (check-recipient in out)))
    (r-i (x-deposit in))
    (r-1 (execute hop-1 (get amount in)))
    (r-2 (execute hop-2 (get dy r-1)))
    (r-3 (execute hop-3 (get dy r-2)))
    (r-4 (execute hop-4 (get dy r-3)))
    (r-w (withdraw out (get dy r-4))))
    (ok (list r-1 r-2 r-3 r-4))))

(define-public (x-swap-5
    (in {token: <subnet-trait>, amount: uint, signature: (buff 65), uuid: (string-ascii 36)})
    (hop-1 {vault: <vault-trait>, opcode: (buff 16)})
    (hop-2 {vault: <vault-trait>, opcode: (buff 16)})
    (hop-3 {vault: <vault-trait>, opcode: (buff 16)})
    (hop-4 {vault: <vault-trait>, opcode: (buff 16)})
    (hop-5 {vault: <vault-trait>, opcode: (buff 16)})
    (out {token: <sip10-trait>, to: principal}))
  (let (
    (r-c (try! (check-recipient in out)))
    (r-i (x-deposit in))
    (r-1 (execute hop-1 (get amount in)))
    (r-2 (execute hop-2 (get dy r-1)))
    (r-3 (execute hop-3 (get dy r-2)))
    (r-4 (execute hop-4 (get dy r-3)))
    (r-5 (execute hop-5 (get dy r-4)))
    (r-w (withdraw out (get dy r-5))))
    (ok (list r-1 r-2 r-3 r-4 r-5))))

