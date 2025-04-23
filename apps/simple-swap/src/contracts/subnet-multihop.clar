;; Title: Signed Multi-hop Router
;; Version: 1.0.0
;; Description: 
;;   Router contract for executing multi-hop swaps across liquidity pools 
;;   that implement the signed-execute interface for subnet compatibility.

;; Use Traits
(use-trait signed-pool-trait .charisma-traits-vX.signed-pool-trait)

;; @desc Execute swap through a single signed pool
(define-private (execute-signed-swap 
    (amount uint) 
    (hop {pool: <signed-pool-trait>, opcode: (optional (buff 16)), signature: (buff 65), uuid: (string-ascii 36)})
    (recipient principal)
  )
  (let ((pool (get pool hop)) (signature (get signature hop)) (uuid (get uuid hop)) (opcode (get opcode hop)))
    (contract-call? pool signed-execute signature amount uuid recipient opcode)))
  
;; --- Core Functions ---

;; @desc Execute single swap through one pool with signatures
(define-public (signed-swap-1 
    (amount uint) 
    (hop-1 {pool: <signed-pool-trait>, opcode: (optional (buff 16)), signature: (buff 65), uuid: (string-ascii 36)})
    (recipient principal)
  )
  (let ((result (try! (execute-signed-swap amount hop-1 recipient))))
    (ok (list result))))

;; @desc Execute two-hop swap through two pools with signatures
(define-public (signed-swap-2
    (amount uint)
    (hop-1 {pool: <signed-pool-trait>, opcode: (optional (buff 16)), signature: (buff 65), uuid: (string-ascii 36)})
    (hop-2 {pool: <signed-pool-trait>, opcode: (optional (buff 16)), signature: (buff 65), uuid: (string-ascii 36)})
    (recipient principal)
  )
  (let (
    (result-1 (try! (execute-signed-swap amount hop-1 (as-contract tx-sender))))
    (result-2 (try! (execute-signed-swap (get dy result-1) hop-2 recipient)))
  )
    (ok (list result-1 result-2))))

;; @desc Execute three-hop swap through three pools with signatures
(define-public (signed-swap-3
    (amount uint)
    (hop-1 {pool: <signed-pool-trait>, opcode: (optional (buff 16)), signature: (buff 65), uuid: (string-ascii 36)})
    (hop-2 {pool: <signed-pool-trait>, opcode: (optional (buff 16)), signature: (buff 65), uuid: (string-ascii 36)})
    (hop-3 {pool: <signed-pool-trait>, opcode: (optional (buff 16)), signature: (buff 65), uuid: (string-ascii 36)})
    (recipient principal)
  )
  (let (
    (result-1 (try! (execute-signed-swap amount hop-1 (as-contract tx-sender))))
    (result-2 (try! (execute-signed-swap (get dy result-1) hop-2 (as-contract tx-sender))))
    (result-3 (try! (execute-signed-swap (get dy result-2) hop-3 recipient)))
  )
    (ok (list result-1 result-2 result-3))))