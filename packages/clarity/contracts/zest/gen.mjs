// Generates one Zest Stacks Swap adapter per Charisma pool from the live vault registry.
// Usage: node gen.mjs <outDir> <poolContractId...>
import { writeFileSync } from 'fs';

const ZEST = 'SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST';

const side = (t) => t.contractId === '.stx' ? 'none' : `(some '${t.contractId})`;
const label = (t) => t.contractId === '.stx' ? 'STX' : t.symbol;

export const adapterName = (pool) => `zest-${pool.split(".")[1]}-v1`;

export const adapterSource = (v, zest = ZEST) => `;; ${v.name} (${label(v.tokenA)}-${label(v.tokenB)}) adapter for Zest Protocol Stacks Swap
;; Plugs one Charisma pool into Zest's routers through their generic swap-trait.
;; Stateless: it holds nothing between swaps. Direction comes from the tokens, so pool-id and x-for-y are unused.

(use-trait ft-trait '${zest}.sip010-trait.sip010-trait)
(impl-trait '${zest}.swap-trait.swap-trait)

;; Opcode order of the pool: 0x00 swaps A for B. none = STX.
(define-constant TOKEN_A ${side(v.tokenA)})
(define-constant TOKEN_B ${side(v.tokenB)})

(define-constant OP_A_TO_B 0x00)
(define-constant OP_B_TO_A 0x01)
(define-constant ERR_ZERO (err u501))
(define-constant ERR_MIN_OUT (err u502))
(define-constant ERR_WRONG_PAIR (err u503))
(define-constant ERR_RESIDUAL (err u504))

(define-private (is-side (token <ft-trait>) (is-stx bool) (side (optional principal)))
  (if is-stx (is-none side) (is-eq side (some (contract-of token)))))

(define-private (bal (token <ft-trait>) (is-stx bool))
  (if is-stx (ok (stx-get-balance current-contract)) (contract-call? token get-balance current-contract)))

(define-private (pull (token <ft-trait>) (is-stx bool) (amount uint))
  (if is-stx
    (stx-transfer? amount tx-sender current-contract)
    (contract-call? token transfer amount tx-sender current-contract none)))

(define-private (execute-pool (amount uint) (opcode (buff 1)))
  (contract-call? '${v.contractId} execute amount (some opcode)))

(define-private (pool-swap (token-in <ft-trait>) (is-stx-in bool) (amount uint) (opcode (buff 1)))
  (if is-stx-in
    (as-contract? ((with-stx amount))
      (try! (execute-pool amount opcode)))
    (as-contract? ((with-ft (contract-of token-in) "*" amount))
      (try! (execute-pool amount opcode)))))

(define-private (forward-out (token-out <ft-trait>) (is-stx-out bool) (out uint) (recipient principal))
  (if is-stx-out
    (as-contract? ((with-stx out))
      (try! (stx-transfer? out tx-sender recipient)))
    (as-contract? ((with-ft (contract-of token-out) "*" out))
      (try! (contract-call? token-out transfer out tx-sender recipient none)))))

(define-public (swap-leg
  (pool-id uint) (x-for-y bool) (is-stx-in bool) (is-stx-out bool)
  (token-in <ft-trait>) (token-out <ft-trait>) (amount-in uint) (min-out uint))
  (let ((caller contract-caller)
        (a-to-b (and (is-side token-in is-stx-in TOKEN_A) (is-side token-out is-stx-out TOKEN_B)))
        (b-to-a (and (is-side token-in is-stx-in TOKEN_B) (is-side token-out is-stx-out TOKEN_A)))
        (before-in (try! (bal token-in is-stx-in)))
        (before-out (try! (bal token-out is-stx-out))))
    (asserts! (> amount-in u0) ERR_ZERO)
    (asserts! (or a-to-b b-to-a) ERR_WRONG_PAIR)
    (try! (pull token-in is-stx-in amount-in))
    (try! (pool-swap token-in is-stx-in amount-in (if a-to-b OP_A_TO_B OP_B_TO_A)))
    (asserts! (is-eq (try! (bal token-in is-stx-in)) before-in) ERR_RESIDUAL)
    (let ((out (- (try! (bal token-out is-stx-out)) before-out)))
      (asserts! (>= out min-out) ERR_MIN_OUT)
      (try! (forward-out token-out is-stx-out out caller))
      (ok out))))
`;

if (process.argv[1].endsWith('gen.mjs')) {
  const [outDir, ...ids] = process.argv.slice(2);
  const res = await fetch('https://invest.charisma.rocks/api/v1/vaults');
  if (!res.ok) throw new Error(`Vault registry returned ${res.status}`);
  const body = await res.json();
  const list = Array.isArray(body) ? body : body.data;
  for (const id of ids) {
    const v = list.find((x) => x.contractId === id);
    if (!v) throw new Error(`Pool ${id} is not in the vault registry`);
    if (v.protocol !== 'CHARISMA' || v.type !== 'POOL') throw new Error(`${id} is ${v.protocol}/${v.type}, not a Charisma pool`);
    const name = adapterName(id);
    if (name.length > 40) throw new Error(`Adapter name ${name} is over the 40-character contract name limit`);
    writeFileSync(`${outDir}/${name}.clar`, adapterSource(v));
    console.log(name);
  }
}
