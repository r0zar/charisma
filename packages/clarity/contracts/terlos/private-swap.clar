;; Title: Private Swap (Terlos x Charisma), DRAFT, not deployed
;; Spend a Terlos shielded STX note, swap it through Charisma's pools, and shield the output into a new note, all in one
;; transaction. The chain sees a note spent, a swap and a note created, but not whose notes they are.
;;
;;   1. zion-stx `withdraw` pays the whole note to this router. Its proof binds this router as the recipient and the
;;      submitter (tx-sender) as the relayer, so a copied transaction can't redirect anything.
;;   2. The router runs the swap hops itself, like Charisma's multihop router.
;;   3. zion-sip10 `shield` turns an agreed amount of the output into the new note; the router pays it plus the pool's
;;      fee. That proof was made for that exact amount, so the swap must deliver at least amount + fee.
;;   4. Whatever the swap delivers beyond that goes to the submitter as its tip.
;;
;; Terlos is an unaudited beta. Tested only on a mainnet fork with real proofs from their prover (private-swap-test.mts).

(use-trait sip010 'SP2NY3DGSVNJFQCNQ4JSKYM433YDHJCPJ9M31DPC5.sip-010-trait.sip-010-trait)
(use-trait vault 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)

(define-constant ERR_SHORT (err u701)) ;; the swap delivered less than the new note plus Terlos's shield fee

(define-private (execute-hop (hop {vault: <vault>, opcode: (buff 16)}) (previous (response uint uint)))
  (let ((amount (try! previous)) (pool (get vault hop)))
    (ok (get dy (try! (as-contract (contract-call? pool execute amount (some (get opcode hop)))))))))

(define-public (stx-note-to-token
    (spend {nullifier: (buff 32), amount: uint, root: (buff 32), relayer-fee: uint, max-fee: uint})
    (spend-proof { trace-root: (buff 32), cons-root: (buff 32), ood: (buff 2048), fri-roots: (list 5 (buff 32)),
      remainder: (buff 128), nonce: uint,
      queries: (list 104 { pos: uint, trace: (buff 512), tpath: (list 13 (buff 32)), cons: (buff 112),
                          cpath: (list 13 (buff 32)), fri: (list 4 { v: (buff 64), p: (list 11 (buff 32)) }) }) })
    (hops (list 4 {vault: <vault>, opcode: (buff 16)}))
    (token <sip010>)
    (uid uint)
    (note {amount: uint, commitment: (buff 32), old-root: (buff 32), new-root: (buff 32), leaf-index: uint, max-fee: uint, memo: (buff 98)})
    (note-proof { trace-root: (buff 32), cons-root: (buff 32), ood: (buff 2048), fri-roots: (list 5 (buff 32)),
      remainder: (buff 128), nonce: uint,
      queries: (list 104 { pos: uint, trace: (buff 512), tpath: (list 13 (buff 32)), cons: (buff 112),
                          cpath: (list 13 (buff 32)), fri: (list 4 { v: (buff 64), p: (list 11 (buff 32)) }) }) }))
  (let (
      (relayer tx-sender)
      (router (as-contract tx-sender))
      (before (unwrap-panic (contract-call? token get-balance router)))
      (received (try! (contract-call? 'SP2NY3DGSVNJFQCNQ4JSKYM433YDHJCPJ9M31DPC5.zion-stx withdraw
        (get nullifier spend) (get amount spend) router (get root spend) relayer (get relayer-fee spend) (get max-fee spend) spend-proof)))
      (out (try! (fold execute-hop hops (ok received))))
      (fee (get fee (try! (contract-call? 'SP2NY3DGSVNJFQCNQ4JSKYM433YDHJCPJ9M31DPC5.asset-registry shield-terms uid (get amount note))))))
    (asserts! (>= out (+ (get amount note) fee)) ERR_SHORT)
    (try! (as-contract (contract-call? 'SP2NY3DGSVNJFQCNQ4JSKYM433YDHJCPJ9M31DPC5.zion-sip10 shield token uid
      (get amount note) (get commitment note) (get old-root note) (get new-root note) (get leaf-index note) (get max-fee note)
      (get memo note) note-proof)))
    (let ((tip (- (unwrap-panic (contract-call? token get-balance router)) before)))
      (if (> tip u0) (try! (as-contract (contract-call? token transfer tip tx-sender relayer none))) true)
      (print {event: "private-swap", received: received, out: out, shielded: (get amount note), fee: fee, tip: tip})
      (ok {received: received, out: out, shielded: (get amount note), tip: tip}))))
