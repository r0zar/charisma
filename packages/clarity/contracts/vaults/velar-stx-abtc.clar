;; Title: Velar STX-aBTC
;; Description: Wraps Velar's STX-aBTC pool (univ2-core pool 3) with the Dexterity interface.
;; Token A = STX, Token B = aBTC. Generated from a proven template (see git history).

;; Traits
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)

;; Constants
(define-constant ERR_INVALID_OPERATION (err u400))

(define-constant TOKEN-NAME "Velar STX-aBTC")
(define-constant TOKEN-SYMBOL "STXABTC")
(define-constant TOKEN-URI (some u"https://metadata.charisma.rocks/api/v1/metadata/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.velar-stx-abtc"))

;; Opcodes
(define-constant OP_SWAP_A_TO_B 0x00)       ;; Swap token A for B
(define-constant OP_SWAP_B_TO_A 0x01)       ;; Swap token B for A
(define-constant OP_LOOKUP_RESERVES 0x04)   ;; Read pool reserves

;; Metadata Functions
(define-read-only (get-name)
    (ok TOKEN-NAME))

(define-read-only (get-symbol)
    (ok TOKEN-SYMBOL))

(define-read-only (get-decimals)
    (ok u6))

(define-read-only (get-token-uri)
    (ok TOKEN-URI))

;; Core Functions
(define-public (execute (amount uint) (opcode (optional (buff 16))))
    (let (
        (operation (get-byte opcode u0)))
        (if (is-eq operation OP_SWAP_A_TO_B) (swap-a-to-b amount)
        (if (is-eq operation OP_SWAP_B_TO_A) (swap-b-to-a amount)
        ERR_INVALID_OPERATION))))

(define-read-only (quote (amount uint) (opcode (optional (buff 16))))
    (let (
        (operation (get-byte opcode u0)))
        (if (is-eq operation OP_SWAP_A_TO_B) (ok {dx: amount, dy: (quote-a-to-b amount), dk: u0})
        (if (is-eq operation OP_SWAP_B_TO_A) (ok {dx: amount, dy: (quote-b-to-a amount), dk: u0})
        (if (is-eq operation OP_LOOKUP_RESERVES) (ok (get-reserves))
        ERR_INVALID_OPERATION)))))

;; Helper Functions
(define-private (get-byte (opcode (optional (buff 16))) (position uint))
    (default-to 0x00 (element-at? (default-to 0x00 opcode) position)))

;; Execute Functions
(define-private (swap-a-to-b (amount uint))
    (let (
        (event (try! (contract-call? 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-router swap-exact-tokens-for-tokens
            u3 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-abtc 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-abtc 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-share-fee-to amount u1))))
        (ok {dx: amount, dy: (get amt-out event), dk: u0})))

(define-private (swap-b-to-a (amount uint))
    (let (
        (event (try! (contract-call? 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-router swap-exact-tokens-for-tokens
            u3 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-abtc 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-abtc 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-share-fee-to amount u1))))
        (ok {dx: amount, dy: (get amt-out event), dk: u0})))

(define-read-only (get-pool)
    (contract-call? 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-core do-get-pool u3))

;; Quote Functions (the router's own math; 0 when it would refuse)
(define-read-only (quote-a-to-b (amount uint))
    (let ((pool (get-pool)))
        (match (contract-call? 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-library get-amount-out amount (get reserve0 pool) (get reserve1 pool) (get swap-fee pool)) out out e u0)))

(define-read-only (quote-b-to-a (amount uint))
    (let ((pool (get-pool)))
        (match (contract-call? 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-library get-amount-out amount (get reserve1 pool) (get reserve0 pool) (get swap-fee pool)) out out e u0)))

(define-read-only (get-reserves)
    (let ((pool (get-pool)))
        {dx: (get reserve0 pool), dy: (get reserve1 pool), dk: u0}))
