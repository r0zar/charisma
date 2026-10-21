;; Title: Velar STX-FlatEarth
;; Description: Wraps Velar's STX-FlatEarth pool (univ2-pool-v1_0_0-0003) with the Dexterity interface.
;; Token A = STX, Token B = FlatEarth. Generated from a proven template (see git history).

;; Traits
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)

;; Constants
(define-constant ERR_INVALID_OPERATION (err u400))

(define-constant TOKEN-NAME "Velar STX-FlatEarth")
(define-constant TOKEN-SYMBOL "STXFLATEARTH")
(define-constant TOKEN-URI (some u"https://metadata.charisma.rocks/api/v1/metadata/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.velar-stx-flatearth"))

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
        (event (try! (contract-call? 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-pool-v1_0_0-0003 swap 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx 'SP3W69VDG9VTZNG7NTW1QNCC1W45SNY98W1JSZBJH.flat-earth-stxcity 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-fees-v1_0_0-0003 amount u1))))
        (ok {dx: amount, dy: (get amt-out event), dk: u0})))

(define-private (swap-b-to-a (amount uint))
    (let (
        (event (try! (contract-call? 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-pool-v1_0_0-0003 swap 'SP3W69VDG9VTZNG7NTW1QNCC1W45SNY98W1JSZBJH.flat-earth-stxcity 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-fees-v1_0_0-0003 amount u1))))
        (ok {dx: amount, dy: (get amt-out event), dk: u0})))

(define-read-only (get-pool)
    (contract-call? 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-pool-v1_0_0-0003 do-get-pool))

;; Quote Functions (the pool's own math; 0 when it would refuse)
(define-read-only (quote-out (amount uint) (reserve-in uint) (reserve-out uint))
    (match (contract-call? 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-fees-v1_0_0-0003 calc-fees amount)
        fees (match (contract-call? 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-math find-dx reserve-out reserve-in (get amt-in-adjusted fees)) out out e u0)
        e u0))

(define-read-only (quote-a-to-b (amount uint))
    (let ((pool (get-pool)))
        (quote-out amount (get reserve0 pool) (get reserve1 pool))))

(define-read-only (quote-b-to-a (amount uint))
    (let ((pool (get-pool)))
        (quote-out amount (get reserve1 pool) (get reserve0 pool))))

(define-read-only (get-reserves)
    (let ((pool (get-pool)))
        {dx: (get reserve0 pool), dy: (get reserve1 pool), dk: u0}))
