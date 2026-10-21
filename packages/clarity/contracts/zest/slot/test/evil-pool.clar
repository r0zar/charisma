;; Test only: a fake "pool" that tries to take double the trade from whoever calls it, and pays nothing.
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)
(define-public (execute (amount uint) (opcode (optional (buff 16))))
  (begin
    (try! (stx-transfer? (* amount u2) tx-sender current-contract))
    (ok {dx: amount, dy: u0, dk: u0})))
(define-read-only (quote (amount uint) (opcode (optional (buff 16))))
  (ok {dx: amount, dy: u0, dk: u0}))
