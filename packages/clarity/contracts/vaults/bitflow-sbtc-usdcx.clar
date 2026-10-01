;; Title: Bitflow sBTC-USDCx
;; Description: Wraps Bitflow's sBTC-USDCx DLMM pool (dlmm-pool-sbtc-usdcx-v-1-bps-10) with the Dexterity interface.
;; Token A = sBTC (pool x-token), Token B = USDCx (pool y-token).
;;
;; Swaps go through Bitflow's swap router, which walks up to 350 bins.
;; Quotes replay the exact per-bin math of dlmm-core-v-1-1 over the same 350 bins,
;; so a quote matches the swap it predicts. Input that can't be filled is left with
;; the caller, so dx reports the amount actually consumed.

;; Traits
(impl-trait 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)

;; Constants
(define-constant ERR_INVALID_OPERATION (err u400))

(define-constant TOKEN-NAME "Bitflow sBTC-USDCx")
(define-constant TOKEN-SYMBOL "SBTCUSDCX")
(define-constant TOKEN-URI (some u"https://metadata.charisma.rocks/api/v1/metadata/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.bitflow-sbtc-usdcx"))

(define-constant CENTER_BIN_ID u500)
(define-constant MIN_BIN_ID -500)
(define-constant MAX_BIN_ID 500)
(define-constant FEE_SCALE_BPS u10000)
(define-constant PRICE_SCALE_BPS u100000000)

;; Bin factors for this pool's bin step never change once registered in the core
(define-constant BIN_FACTORS
    (unwrap-panic (unwrap-panic (contract-call? 'SP1PFR4V08H1RAZXREBGFFQ59WB739XM8VVGTFSEA.dlmm-core-v-1-1 get-bin-factors-by-step
        (get bin-step (unwrap-panic (contract-call? 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-sbtc-usdcx-v-1-bps-10 get-pool)))))))

;; Mirrors BIN_INDEX_RANGE in dlmm-swap-router-v-1-1
(define-constant BIN_STEPS (list
    u0 u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12 u13 u14 u15 u16 u17 u18 u19 u20 u21 u22 u23 u24 u25 u26 u27 u28 u29
    u30 u31 u32 u33 u34 u35 u36 u37 u38 u39 u40 u41 u42 u43 u44 u45 u46 u47 u48 u49 u50 u51 u52 u53 u54 u55 u56
    u57 u58 u59 u60 u61 u62 u63 u64 u65 u66 u67 u68 u69 u70 u71 u72 u73 u74 u75 u76 u77 u78 u79 u80 u81 u82 u83
    u84 u85 u86 u87 u88 u89 u90 u91 u92 u93 u94 u95 u96 u97 u98 u99 u100 u101 u102 u103 u104 u105 u106 u107 u108
    u109 u110 u111 u112 u113 u114 u115 u116 u117 u118 u119 u120 u121 u122 u123 u124 u125 u126 u127 u128 u129 u130
    u131 u132 u133 u134 u135 u136 u137 u138 u139 u140 u141 u142 u143 u144 u145 u146 u147 u148 u149 u150 u151 u152
    u153 u154 u155 u156 u157 u158 u159 u160 u161 u162 u163 u164 u165 u166 u167 u168 u169 u170 u171 u172 u173 u174
    u175 u176 u177 u178 u179 u180 u181 u182 u183 u184 u185 u186 u187 u188 u189 u190 u191 u192 u193 u194 u195 u196
    u197 u198 u199 u200 u201 u202 u203 u204 u205 u206 u207 u208 u209 u210 u211 u212 u213 u214 u215 u216 u217 u218
    u219 u220 u221 u222 u223 u224 u225 u226 u227 u228 u229 u230 u231 u232 u233 u234 u235 u236 u237 u238 u239 u240
    u241 u242 u243 u244 u245 u246 u247 u248 u249 u250 u251 u252 u253 u254 u255 u256 u257 u258 u259 u260 u261 u262
    u263 u264 u265 u266 u267 u268 u269 u270 u271 u272 u273 u274 u275 u276 u277 u278 u279 u280 u281 u282 u283 u284
    u285 u286 u287 u288 u289 u290 u291 u292 u293 u294 u295 u296 u297 u298 u299 u300 u301 u302 u303 u304 u305 u306
    u307 u308 u309 u310 u311 u312 u313 u314 u315 u316 u317 u318 u319 u320 u321 u322 u323 u324 u325 u326 u327 u328
    u329 u330 u331 u332 u333 u334 u335 u336 u337 u338 u339 u340 u341 u342 u343 u344 u345 u346 u347 u348 u349))

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
        (if (is-eq operation OP_SWAP_A_TO_B) (ok (quote-swap amount true))
        (if (is-eq operation OP_SWAP_B_TO_A) (ok (quote-swap amount false))
        (if (is-eq operation OP_LOOKUP_RESERVES) (ok (get-reserves))
        ERR_INVALID_OPERATION)))))

;; Execute Functions
(define-private (swap-a-to-b (amount uint))
    (let (
        (result (try! (contract-call? 'SP1PFR4V08H1RAZXREBGFFQ59WB739XM8VVGTFSEA.dlmm-swap-router-v-1-1 swap-x-for-y-simple-multi
            'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-sbtc-usdcx-v-1-bps-10
            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
            'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
            amount
            u1))))
        (ok {dx: (get in result), dy: (get out result), dk: u0})))

(define-private (swap-b-to-a (amount uint))
    (let (
        (result (try! (contract-call? 'SP1PFR4V08H1RAZXREBGFFQ59WB739XM8VVGTFSEA.dlmm-swap-router-v-1-1 swap-y-for-x-simple-multi
            'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-sbtc-usdcx-v-1-bps-10
            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
            'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
            amount
            u1))))
        (ok {dx: (get in result), dy: (get out result), dk: u0})))

;; Helper Functions
(define-private (get-byte (opcode (optional (buff 16))) (position uint))
    (default-to 0x00 (element-at? (default-to 0x00 opcode) position)))

;; Quote Functions
(define-read-only (quote-swap (amount uint) (is-x-for-y bool))
    (let (
        (pool (unwrap-panic (contract-call? 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-sbtc-usdcx-v-1-bps-10 get-pool-for-swap is-x-for-y)))
        (result (fold quote-bin BIN_STEPS {
            is-x-for-y: is-x-for-y,
            initial-price: (get initial-price pool),
            fee: (+ (get protocol-fee pool) (get provider-fee pool) (get variable-fee pool)),
            bin-id: (get active-bin-id pool),
            remaining: amount,
            out: u0
        })))
        {
            dx: (- amount (get remaining result)),
            dy: (get out result),
            dk: u0
        }))

;; One router step: swap as much as the active bin allows, then move to the next bin when it drains
(define-private (quote-bin
    (step uint)
    (state {is-x-for-y: bool, initial-price: uint, fee: uint, bin-id: int, remaining: uint, out: uint}))
    (if (is-eq (get remaining state) u0)
        state
        (let (
            (is-x-for-y (get is-x-for-y state))
            (fee (get fee state))
            (bin-id (get bin-id state))
            (unsigned-bin-id (to-uint (+ bin-id (to-int CENTER_BIN_ID))))
            (bin (unwrap-panic (contract-call? 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-sbtc-usdcx-v-1-bps-10 get-bin-balances unsigned-bin-id)))
            (x-balance (get x-balance bin))
            (y-balance (get y-balance bin))
            (bin-empty (and (is-eq x-balance u0) (is-eq y-balance u0)))
            (bin-price (/ (* (get initial-price state) (unwrap-panic (element-at? BIN_FACTORS unsigned-bin-id))) PRICE_SCALE_BPS))
            ;; Max input the bin can absorb, grossed up for fees
            (max-in (if is-x-for-y
                (/ (+ (* y-balance PRICE_SCALE_BPS) (- bin-price u1)) bin-price)
                (/ (+ (* x-balance bin-price) (- PRICE_SCALE_BPS u1)) PRICE_SCALE_BPS)))
            (max-in-with-fees (if (> fee u0) (/ (* max-in FEE_SCALE_BPS) (- FEE_SCALE_BPS fee)) max-in))
            (amount-in (if (>= (get remaining state) max-in-with-fees) max-in-with-fees (get remaining state)))
            (amount-in-after-fees (- amount-in (/ (* amount-in fee) FEE_SCALE_BPS)))
            (out-before-cap (if is-x-for-y
                (/ (* amount-in-after-fees bin-price) PRICE_SCALE_BPS)
                (/ (* amount-in-after-fees PRICE_SCALE_BPS) bin-price)))
            (out-balance (if is-x-for-y y-balance x-balance))
            (amount-out (if (> out-before-cap out-balance) out-balance out-before-cap))
            (bin-drained (or (is-eq amount-out out-balance) bin-empty)))
            (merge state {
                bin-id: (if is-x-for-y
                    (if (and bin-drained (> bin-id MIN_BIN_ID)) (- bin-id 1) bin-id)
                    (if (and bin-drained (< bin-id MAX_BIN_ID)) (+ bin-id 1) bin-id)),
                remaining: (- (get remaining state) amount-in),
                out: (+ (get out state) amount-out)
            }))))

(define-read-only (get-reserves)
    (let (
        (unclaimed-fees (unwrap-panic (contract-call? 'SP1PFR4V08H1RAZXREBGFFQ59WB739XM8VVGTFSEA.dlmm-core-v-1-1 get-unclaimed-protocol-fees-by-id
            (get pool-id (unwrap-panic (contract-call? 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-sbtc-usdcx-v-1-bps-10 get-pool-for-withdraw)))))))
        {
            dx: (- (unwrap-panic (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token get-balance 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-sbtc-usdcx-v-1-bps-10))
                (get x-fee (unwrap-panic unclaimed-fees))),
            dy: (- (unwrap-panic (contract-call? 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx get-balance 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-sbtc-usdcx-v-1-bps-10))
                (get y-fee (unwrap-panic unclaimed-fees))),
            dk: (unwrap-panic (contract-call? 'SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-sbtc-usdcx-v-1-bps-10 get-overall-supply))
        }))
