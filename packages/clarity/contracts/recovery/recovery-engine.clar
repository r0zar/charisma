;; Charisma Recovery Engine
;; https://charisma.rocks
;;
;; Burn your IOUs and get the original token back 1:1, as far as the engine's funds go:
;;   iouWELSH (synthetic-welsh) -> WELSH
;;   iouROO   (synthetic-roo)   -> ROO
;;   synSTX   (synthetic-stx)   -> STX
;;
;; Anyone can fund the engine by sending WELSH, ROO or STX to this contract.
;; There is no withdraw: funds only ever leave when someone burns IOUs for them.

(define-constant ERR-NOTHING-TO-REDEEM (err u400))

(define-constant ENGINE (as-contract tx-sender))

;; --- What the engine can pay out right now

(define-read-only (get-available-welsh)
  (unwrap-panic (contract-call? 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token get-balance ENGINE))
)

(define-read-only (get-available-roo)
  (unwrap-panic (contract-call? 'SP2C1WREHGM75C7TGFAEJPFKTFTEGZKF6DFT6E2GE.kangaroo get-balance ENGINE))
)

(define-read-only (get-available-stx)
  (stx-get-balance ENGINE)
)

(define-read-only (get-available)
  { welsh: (get-available-welsh), roo: (get-available-roo), stx: (get-available-stx) }
)

(define-private (smaller (a uint) (b uint))
  (if (< a b) a b)
)

;; --- Redeeming: each burns up to `amount` of the caller's IOUs and pays the same amount back.
;; Each returns how much was redeemed, which is 0 when the engine is empty or `amount` is 0.

(define-private (take-welsh (amount uint))
  (let (
    (who tx-sender)
    (paid (smaller amount (get-available-welsh)))
  )
    (if (is-eq paid u0)
      (ok u0)
      (begin
        (try! (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.synthetic-welsh burn paid))
        (try! (as-contract (contract-call? 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token transfer paid tx-sender who none)))
        (print { event: "redeem", token: "welsh", who: who, amount: paid })
        (ok paid)
      )
    )
  )
)

(define-private (take-roo (amount uint))
  (let (
    (who tx-sender)
    (paid (smaller amount (get-available-roo)))
  )
    (if (is-eq paid u0)
      (ok u0)
      (begin
        (try! (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.synthetic-roo burn paid))
        (try! (as-contract (contract-call? 'SP2C1WREHGM75C7TGFAEJPFKTFTEGZKF6DFT6E2GE.kangaroo transfer paid tx-sender who none)))
        (print { event: "redeem", token: "roo", who: who, amount: paid })
        (ok paid)
      )
    )
  )
)

(define-private (take-stx (amount uint))
  (let (
    (who tx-sender)
    (paid (smaller amount (get-available-stx)))
  )
    (if (is-eq paid u0)
      (ok u0)
      (begin
        (try! (contract-call? 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.synthetic-stx burn paid))
        (try! (as-contract (stx-transfer? paid tx-sender who)))
        (print { event: "redeem", token: "stx", who: who, amount: paid })
        (ok paid)
      )
    )
  )
)

(define-public (redeem-welsh (amount uint))
  (let ((paid (try! (take-welsh amount))))
    (asserts! (> paid u0) ERR-NOTHING-TO-REDEEM)
    (ok paid)
  )
)

(define-public (redeem-roo (amount uint))
  (let ((paid (try! (take-roo amount))))
    (asserts! (> paid u0) ERR-NOTHING-TO-REDEEM)
    (ok paid)
  )
)

(define-public (redeem-stx (amount uint))
  (let ((paid (try! (take-stx amount))))
    (asserts! (> paid u0) ERR-NOTHING-TO-REDEEM)
    (ok paid)
  )
)

;; One click: redeem up to these amounts of each IOU, as far as the engine's funds go
(define-public (redeem-all (welsh uint) (roo uint) (stx uint))
  (let (
    (paid-welsh (try! (take-welsh welsh)))
    (paid-roo (try! (take-roo roo)))
    (paid-stx (try! (take-stx stx)))
  )
    (asserts! (> (+ paid-welsh paid-roo paid-stx) u0) ERR-NOTHING-TO-REDEEM)
    (ok { welsh: paid-welsh, roo: paid-roo, stx: paid-stx })
  )
)
