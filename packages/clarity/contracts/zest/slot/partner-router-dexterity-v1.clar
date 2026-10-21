;; Zest Protocol partner-router-v1 plus a Dexterity slot `v` (adapter + pool), so one adapter serves every Charisma pool.
;; Unchanged otherwise; Zest's relative references are written out so the copy runs from any address.
(use-trait sip010-trait 'SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST.sip010-trait.sip010-trait)
(use-trait swap-trait 'SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST.swap-trait.swap-trait)
(use-trait xyk-pool 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-trait-v-1-2.xyk-pool-trait)
(use-trait swap-xyk 'SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST.swap-trait-xyk.swap-trait-xyk)
(use-trait ss-pool 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-trait-v-1-2.stableswap-pool-trait)
(use-trait swap-stableswap 'SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST.swap-trait-stableswap.swap-trait-stableswap)
(use-trait dlmm-pool 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-trait-v-1-1.dlmm-pool-trait)
(use-trait swap-dlmm 'SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST.swap-trait-dlmm.swap-trait-dlmm)
(use-trait curve-pool 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.curve-pool-trait_v1_0_0.curve-pool-trait)
(use-trait curve-fees 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.curve-fees-trait_v1_0_0.curve-fees-trait)
(use-trait swap-curve 'SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST.swap-trait-curve.swap-trait-curve)
(use-trait alex-ft 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.trait-sip-010.sip-010-trait)
(use-trait swap-alex 'SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST.swap-trait-alex.swap-trait-alex)
(use-trait dexterity-pool 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)
(use-trait swap-dexterity .swap-trait-dexterity.swap-trait-dexterity)
(define-constant TREASURY 'SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST.treasury)
(define-constant ERR_DEADLINE_PASSED (err u1000))
(define-constant ERR_SKIM_OVER_MAX (err u1001))
(define-constant ERR_INSUFFICIENT_OUTPUT (err u1002))
(define-constant ERR_ZERO_AMOUNT (err u1004))
(define-constant ERR_SKIM_OVER_GROSS (err u1005))
(define-constant ERR_SAME_TOKEN (err u1006))
(define-constant ERR_STX_BOTH_SIDES (err u1007))
(define-constant ERR_STX_FLOAT (err u1011))
(define-constant ERR_SPLIT_OUTPUT_MISMATCH (err u1012))
(define-constant ERR_DELIVERY_MISMATCH (err u1013))
(define-constant ERR_ROUTER_OUTFLOW (err u1014))
(define-constant ERR_INPUT_DELIVERY (err u1015))
(define-constant ERR_INPUT_OUTFLOW (err u1016))
(define-private (require-deadline (d uint)) (begin (asserts! (>= d stacks-block-height) ERR_DEADLINE_PASSED) (ok true)))
(define-private (require-skim-bounds (s uint) (m uint)) (begin (asserts! (<= s m) ERR_SKIM_OVER_MAX) (ok true)))
(define-private (require-non-zero (n uint)) (begin (asserts! (> n u0) ERR_ZERO_AMOUNT) (ok true)))
(define-private (require-route-common (d uint) (s uint) (m uint)) (begin (try! (require-deadline d)) (try! (require-skim-bounds s m)) (ok true)))
(define-private (pull-leg (si bool) (ti <sip010-trait>) (a uint)) (if si (stx-transfer? a tx-sender current-contract) (contract-call? ti transfer a tx-sender current-contract none)))
(define-private (asset-balance (s bool) (t <sip010-trait>) (p principal)) (if s (ok (stx-get-balance p)) (contract-call? t get-balance p)))
(define-private (leg-balance (s bool) (t <sip010-trait>)) (asset-balance s t current-contract))
(define-private (pull-exact (si bool) (ti <sip010-trait>) (a uint)) (let ((rb (try! (asset-balance si ti current-contract))) (sb (try! (asset-balance si ti tx-sender)))) (try! (pull-leg si ti a)) (asserts! (is-eq (try! (asset-balance si ti current-contract)) (+ rb a)) ERR_INPUT_DELIVERY) (asserts! (is-eq (+ (try! (asset-balance si ti tx-sender)) a) sb) ERR_INPUT_OUTFLOW) (ok true)))
(define-private (transfer-from-router (so bool) (t <sip010-trait>) (a uint) (r principal)) (if so (as-contract? ((with-stx a)) (try! (stx-transfer? a tx-sender r))) (as-contract? ((with-ft (contract-of t) "*" a)) (try! (contract-call? t transfer a tx-sender r none)))))
(define-private (transfer-exact (so bool) (t <sip010-trait>) (a uint) (r principal)) (if (is-eq a u0) (ok true) (let ((rb (try! (asset-balance so t current-contract))) (db (try! (asset-balance so t r)))) (try! (transfer-from-router so t a r)) (asserts! (is-eq (try! (asset-balance so t r)) (+ db a)) ERR_DELIVERY_MISMATCH) (asserts! (is-eq (+ (try! (asset-balance so t current-contract)) a) rb) ERR_ROUTER_OUTFLOW) (ok true))))
(define-private (require-swap-invariants (si bool) (so bool) (ti <sip010-trait>) (to <sip010-trait>)) (begin (asserts! (not (and si so)) ERR_STX_BOTH_SIDES) (asserts! (or si so (not (is-eq (contract-of ti) (contract-of to)))) ERR_SAME_TOKEN) (ok true)))




(define-constant ERR_PLAN (err u1017))
(define-constant ERR_HOP_INPUT (err u1018))
(define-constant ERR_VARIANT (err u1019))
(define-constant ERR_OUTPUT_DELTA (err u1020))
(define-constant MAX_UINT u340282366920938463463374607431768211455)
(define-private (sum-amount (a uint) (b uint))
  (begin
    (asserts! (<= b (- MAX_UINT a)) ERR_PLAN)
    (ok (+ a b))))
(define-private (same-asset (sa bool) (ta <sip010-trait>) (sb bool) (tb <sip010-trait>))
  (and (is-eq sa sb) (or sa (is-eq (contract-of ta) (contract-of tb)))))

(define-constant ERR_PARTNER_FEE (err u1021))
(define-constant ERR_RECEIPT (err u1022))
(define-constant ERR_RECEIPT_USED (err u1023))
(define-map receipts {sponsor: principal, receipt-id: uint} bool)
(define-read-only (get-receipt (sponsor principal) (receipt-id uint))
  (default-to false (map-get? receipts {sponsor: sponsor, receipt-id: receipt-id})))
(define-private (require-receipt (receipt-id uint))
  (match tx-sponsor?
    sponsor (begin
      (asserts! (> receipt-id u0) ERR_RECEIPT)
      (asserts! (not (get-receipt sponsor receipt-id)) ERR_RECEIPT_USED)
      (ok true))
    (begin
      (asserts! (is-eq receipt-id u0) ERR_RECEIPT)
      (ok true))))
(define-private (record-receipt (receipt-id uint))
  (match tx-sponsor?
    sponsor (map-set receipts {sponsor: sponsor, receipt-id: receipt-id} true)
    true))
(define-private (settle-partner (to <sip010-trait>) (so bool) (g uint) (s uint) (mo uint) (r principal) (sb uint) (p uint) (pr principal))
  (begin
    (asserts! (>= g s) ERR_SKIM_OVER_GROSS)
    (asserts! (<= p s) ERR_PARTNER_FEE)
    (asserts! (or (is-eq p u0) (not (or (is-eq pr current-contract) (is-eq pr TREASURY)))) ERR_PARTNER_FEE)
    (let ((n (- g s)))
      (asserts! (>= n mo) ERR_INSUFFICIENT_OUTPUT)
      (try! (require-non-zero n))
      (try! (transfer-exact so to (- s p) TREASURY))
      (try! (transfer-exact so to p pr))
      (try! (transfer-exact so to n r))
      (asserts! (is-eq (stx-get-balance current-contract) sb) ERR_STX_FLOAT)
      (ok n))))

(define-private (dispatch-hop (h {
  token-in: <sip010-trait>, token-out: <sip010-trait>,
  is-stx-in: bool, is-stx-out: bool, x-to-y: bool, min-out: uint,
  t: (optional {adapter: <swap-trait>, pool-id: uint}),
  x: (optional {adapter: <swap-xyk>, pool: <xyk-pool>}),
  s: (optional {adapter: <swap-stableswap>, pool: <ss-pool>}),
  d: (optional {adapter: <swap-dlmm>, pool: <dlmm-pool>}),
  c: (optional {adapter: <swap-curve>, pool: <curve-pool>, fees: <curve-fees>}),
  a: (optional {adapter: <swap-alex>, factor: uint, token-x: <alex-ft>, token-y: <alex-ft>}),
  v: (optional {adapter: <swap-dexterity>, pool: <dexterity-pool>})
}) (amount uint))
  (let ((ti (get token-in h)) (to (get token-out h))
        (si (get is-stx-in h)) (so (get is-stx-out h))
        (xy (get x-to-y h)) (minimum (get min-out h)))
    (asserts! (is-eq u1 (+
      (if (is-some (get t h)) u1 u0) (if (is-some (get x h)) u1 u0)
      (if (is-some (get s h)) u1 u0) (if (is-some (get d h)) u1 u0)
      (if (is-some (get c h)) u1 u0) (if (is-some (get a h)) u1 u0)
      (if (is-some (get v h)) u1 u0))) ERR_VARIANT)
    (match (get t h) v
      (let ((ad (get adapter v)))
        (contract-call? ad swap-leg (get pool-id v) xy si so ti to amount minimum))
    (match (get x h) v
      (let ((ad (get adapter v)))
        (contract-call? ad swap-leg (get pool v) xy si so ti to amount minimum))
    (match (get s h) v
      (let ((ad (get adapter v)))
        (contract-call? ad swap-leg (get pool v) xy si so ti to amount minimum))
    (match (get d h) v
      (let ((ad (get adapter v)))
        (contract-call? ad swap-leg (get pool v) xy si so ti to amount minimum))
    (match (get c h) v
      (let ((ad (get adapter v)))
        (contract-call? ad swap-leg (get pool v) (get fees v) xy si so ti to amount minimum))
    (match (get a h) v
      (let ((ad (get adapter v)))
        (contract-call? ad swap-leg-alex (get factor v) (get token-x v) (get token-y v) xy si so ti to amount minimum))
    (match (get v h) v
      (let ((ad (get adapter v)))
        (contract-call? ad swap-leg (get pool v) xy si so ti to amount minimum))
      ERR_VARIANT)))))))))

(define-private (execute-hop (h {
  token-in: <sip010-trait>, token-out: <sip010-trait>,
  is-stx-in: bool, is-stx-out: bool, x-to-y: bool, min-out: uint,
  t: (optional {adapter: <swap-trait>, pool-id: uint}),
  x: (optional {adapter: <swap-xyk>, pool: <xyk-pool>}),
  s: (optional {adapter: <swap-stableswap>, pool: <ss-pool>}),
  d: (optional {adapter: <swap-dlmm>, pool: <dlmm-pool>}),
  c: (optional {adapter: <swap-curve>, pool: <curve-pool>, fees: <curve-fees>}),
  a: (optional {adapter: <swap-alex>, factor: uint, token-x: <alex-ft>, token-y: <alex-ft>}),
  v: (optional {adapter: <swap-dexterity>, pool: <dexterity-pool>})
}) (previous (response {amount: uint, token: <sip010-trait>, stx: bool} uint)))
  (let ((state (try! previous)) (ti (get token-in h)) (to (get token-out h))
        (si (get is-stx-in h)) (so (get is-stx-out h))
        (amount (get amount state)) (minimum (get min-out h)))
    (asserts! (same-asset (get stx state) (get token state) si ti) ERR_PLAN)
    (try! (require-swap-invariants si so ti to))
    (try! (require-non-zero amount))
    (try! (require-non-zero minimum))
    (let ((before-in (try! (leg-balance si ti)))
          (before-out (try! (leg-balance so to))))
      (try! (if si
        (as-contract? ((with-stx amount)) (try! (dispatch-hop h amount)))
        (as-contract? ((with-ft (contract-of ti) "*" amount)) (try! (dispatch-hop h amount)))))
      (let ((after-in (try! (leg-balance si ti)))
            (after-out (try! (leg-balance so to))))
        (asserts! (>= before-in after-in) ERR_HOP_INPUT)
        (asserts! (is-eq (- before-in after-in) amount) ERR_HOP_INPUT)
        (asserts! (>= after-out before-out) ERR_OUTPUT_DELTA)
        (let ((actual (- after-out before-out)))
          (asserts! (>= actual minimum) ERR_INSUFFICIENT_OUTPUT)
          (ok {amount: actual, token: to, stx: so}))))))

(define-private (execute-path (p {amount-in: uint, hops: (list 4 {
  token-in: <sip010-trait>, token-out: <sip010-trait>,
  is-stx-in: bool, is-stx-out: bool, x-to-y: bool, min-out: uint,
  t: (optional {adapter: <swap-trait>, pool-id: uint}),
  x: (optional {adapter: <swap-xyk>, pool: <xyk-pool>}),
  s: (optional {adapter: <swap-stableswap>, pool: <ss-pool>}),
  d: (optional {adapter: <swap-dlmm>, pool: <dlmm-pool>}),
  c: (optional {adapter: <swap-curve>, pool: <curve-pool>, fees: <curve-fees>}),
  a: (optional {adapter: <swap-alex>, factor: uint, token-x: <alex-ft>, token-y: <alex-ft>}),
  v: (optional {adapter: <swap-dexterity>, pool: <dexterity-pool>})
})}) (previous (response {
  token-in: <sip010-trait>, token-out: <sip010-trait>,
  is-stx-in: bool, is-stx-out: bool,
  total-in: uint, total-out: uint, hop-count: uint
} uint)))
  (let ((state (try! previous)) (amount (get amount-in p))
        (hops (get hops p)) (hop-count (+ (get hop-count state) (len hops))))
    (try! (require-non-zero amount))
    (asserts! (and (> (len hops) u0) (<= hop-count u4)) ERR_PLAN)
    (let ((result (try! (fold execute-hop hops
            (ok {amount: amount, token: (get token-in state), stx: (get is-stx-in state)})))))
      (asserts! (same-asset (get stx result) (get token result)
        (get is-stx-out state) (get token-out state)) ERR_PLAN)
      (ok (merge state {
        total-in: (try! (sum-amount (get total-in state) amount)),
        total-out: (try! (sum-amount (get total-out state) (get amount result))),
        hop-count: hop-count})))))

(define-public (swap
  (t-in <sip010-trait>) (t-out <sip010-trait>)
  (is-stx-in bool) (is-stx-out bool) (amount-in uint)
  (paths (list 2 {amount-in: uint, hops: (list 4 {
  token-in: <sip010-trait>, token-out: <sip010-trait>,
  is-stx-in: bool, is-stx-out: bool, x-to-y: bool, min-out: uint,
  t: (optional {adapter: <swap-trait>, pool-id: uint}),
  x: (optional {adapter: <swap-xyk>, pool: <xyk-pool>}),
  s: (optional {adapter: <swap-stableswap>, pool: <ss-pool>}),
  d: (optional {adapter: <swap-dlmm>, pool: <dlmm-pool>}),
  c: (optional {adapter: <swap-curve>, pool: <curve-pool>, fees: <curve-fees>}),
  a: (optional {adapter: <swap-alex>, factor: uint, token-x: <alex-ft>, token-y: <alex-ft>}),
  v: (optional {adapter: <swap-dexterity>, pool: <dexterity-pool>})
})}))
  (min-out uint) (deadline uint) (skim-amount uint) (max-skim uint) (recipient principal)
  (partner-amount uint) (partner-recipient principal) (receipt-id uint))
  (begin
    (try! (require-route-common deadline skim-amount max-skim))
    (try! (require-non-zero amount-in))
    (try! (require-swap-invariants is-stx-in is-stx-out t-in t-out))
    (try! (require-receipt receipt-id))
    (let ((sb (stx-get-balance current-contract))
          (before-out (try! (leg-balance is-stx-out t-out)))
          (p0 (unwrap! (element-at? paths u0) ERR_PLAN))
          (p1-in (match (element-at? paths u1) p1 (get amount-in p1) u0))
          (p1-hops (match (element-at? paths u1) p1 (len (get hops p1)) u0)))
      (asserts! (is-eq (try! (sum-amount (get amount-in p0) p1-in)) amount-in) ERR_PLAN)
      (asserts! (<= (+ (len (get hops p0)) p1-hops) u4) ERR_PLAN)
      (try! (pull-exact is-stx-in t-in amount-in))
      (let ((result (try! (fold execute-path paths (ok {
              token-in: t-in, token-out: t-out,
              is-stx-in: is-stx-in, is-stx-out: is-stx-out,
              total-in: u0, total-out: u0, hop-count: u0}))))
            (after-out (try! (leg-balance is-stx-out t-out))))
        (asserts! (>= after-out before-out) ERR_OUTPUT_DELTA)
        (asserts! (is-eq (get total-in result) amount-in) ERR_PLAN)
        (let ((gross (- after-out before-out)))
          (asserts! (is-eq gross (get total-out result)) ERR_OUTPUT_DELTA)
          (let ((net (try! (settle-partner t-out is-stx-out gross skim-amount min-out recipient sb partner-amount partner-recipient))))
            (record-receipt receipt-id)
            (ok net)))))))

