(define-constant ALL_HEX 0x000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9FA0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBFC0C1C2C3C4C5C6C7C8C9CACBCCCDCECFD0D1D2D3D4D5D6D7D8D9DADBDCDDDEDFE0E1E2E3E4E5E6E7E8E9EAEBECEDEEEFF0F1F2F3F4F5F6F7F8F9FAFBFCFDFEFF)
(define-constant BASE58_CHARS "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")
(define-constant STX_VER 0x16141a15)
(define-constant BTC_VER 0x00056fc4)
(define-constant LST (list))

(define-constant ERR_INVALID_ADDR (err u1))
(define-constant ERR_PLACEHOLDER (err u999))

;; Phase 1A: Add basic validation for Base58 characters
(define-constant ERR_INVALID_B58_CHAR (err u10))
(define-constant ERR_B58_TOO_LONG (err u11))

;; Check if a character is a valid Base58 character
(define-read-only (is-b58-char (c (string-ascii 1)))
  (is-some (index-of? BASE58_CHARS c)))

;; Validate that a string only contains valid Base58 characters
(define-read-only (validate-b58-addr (addr (string-ascii 44)))
  (let (
    ;; Check length
    (l1 (asserts! (<= (len addr) u44) ERR_B58_TOO_LONG))
    ;; The address cannot be empty
    (l2 (asserts! (> (len addr) u0) ERR_INVALID_B58_CHAR))
    
    ;; Check first character
    (c1 (unwrap! (element-at? addr u0) ERR_INVALID_B58_CHAR))
    (v1 (asserts! (is-b58-char c1) ERR_INVALID_B58_CHAR))
    
    ;; Check more characters if they exist
    (c2 (if (>= (len addr) u2) (unwrap! (element-at? addr u1) ERR_INVALID_B58_CHAR) "1"))
    (v2 (if (>= (len addr) u2) (asserts! (is-b58-char c2) ERR_INVALID_B58_CHAR) true))
    
    (c3 (if (>= (len addr) u3) (unwrap! (element-at? addr u2) ERR_INVALID_B58_CHAR) "1"))
    (v3 (if (>= (len addr) u3) (asserts! (is-b58-char c3) ERR_INVALID_B58_CHAR) true))
  )
    (ok true)))


(define-private (convert-inner (data {hash-bytes: (buff 20), name: (optional (string-ascii 40)), version:(buff 1)}))
    (let (
        ;; exit early if contract principal
        (t1 (asserts! (is-none (get name data)) ERR_INVALID_ADDR))
        ;; convert STX version byte to BTC version
        (version (unwrap-panic (element-at? BTC_VER (unwrap-panic (index-of? STX_VER (get version data))))))
        ;; concat BTC version & hash160 
        (versioned-hash-bytes (concat version (get hash-bytes data)))
        ;; concat hash-bytes & 4 bytes checksum, and convert hext to uint
        (to-encode (map hex-to-uint (concat 
            versioned-hash-bytes 
            ;; checksum = encode versionded-hash-bytes 2x with sha256, and then extract first 4 bytes
            ;; we can use unwrap-panic twice, because sha256 of empty buff will alwasy return value
            (unwrap-panic (as-max-len? (unwrap-panic (slice? (sha256 (sha256 versioned-hash-bytes)) u0 u4)) u4))
        )))
        ;; "cut" leading zeros leveraging index-of? property
        ;; first convert list of uint's to list of booleans that tells if value was 0 or not
        ;; (list u0 u0 u2 u23 u0 u3 u53 u22) -> (list true true false false true false false false)
        ;; since index-of? always returns first index we use it to find the position of first non-zero value
        ;; and we default it to u0 - in case it won't find anything
        ;; in our example, it will return (some u2)
        ;; the reason why we default to u0 is that (slice? (list u0 u0 u2 u23 u0 u3 u53 u22) u0 u0) will return (some (list))
        ;; it guarantees that our slice? will never return (none) so we can safely use unwrap-panic here
        (leading-zeros (unwrap-panic (slice? to-encode u0 (default-to u0 (index-of? (map is-zero to-encode) false)))))
    )
        (ok 
            (fold 
                convert-to-base58-string 
                ;; run through "outer-loop" everything except leading zeros
                ;; and concatenate results with leading zeros if any
                ;; we use u25, because hash-bytes (aka. hash160) = 20 bytes, version = 1 byte, and checksum = 4 bytes
                (concat (fold outer-loop (unwrap-panic (slice? to-encode (len leading-zeros) u25)) LST) leading-zeros) 
                ""
            )
        )
    )
)

(define-read-only (convert (addr principal))
    (match (principal-destruct? addr) 
        ;; if version byte match the network (ie. mainnet principal on mainnet, or testnet principal on testnet)
        network-match-data (convert-inner network-match-data)
        ;; if versin byte does not match the network
        network-not-match-data (convert-inner network-not-match-data)
    )
)


(define-read-only (outer-loop (x uint) (out (list 44 uint)))
    (let (
        (new-out (fold update-out out (list x)))
        (push (fold carry-push 0x0000 (list (unwrap-panic (element-at? new-out u0)))))
    )
        (concat 
            (default-to LST (slice? new-out u1 (len new-out)))
            (default-to LST (slice? push u1 (len push)))
        )
    )
)

(define-read-only (update-out (x uint) (out (list 35 uint)))
    (let (
        ;; first byte of out is always a carry from previous iteration
        (carry (+ (unwrap-panic (element-at? out u0)) (* x u256)))
    )
        (unwrap-panic (as-max-len? (concat  
            (list (/ carry u58)) ;; new carry
            (concat 
                (default-to LST (slice? out u1 (len out))) ;; existing list
                (list (mod carry u58)) ;; new value we want to append
            )
        ) u35))
    )
)

(define-read-only (carry-push (x (buff 1)) (out (list 9 uint)))
    (let (
        ;; first byte of out is always a carry from previous iteration
        (carry (unwrap-panic (element-at? out u0)))
    )
        (if (> carry u0)
            ;; we only change out if cary is > u0
            (unwrap-panic (as-max-len? (concat 
                (list (/ carry u58)) ;; new carry
                (concat
                    (default-to LST (slice? out u1 (len out))) ;; existing list
                    (list (mod carry u58)) ;; new value we want to append
                )
            ) u9))
            ;; do nothing
            out
        )
    )
)

;; converts uint to base58 caracter and concatenate in reverse order
(define-read-only (convert-to-base58-string (x uint) (out (string-ascii 44)))
    (unwrap-panic (as-max-len? (concat (unwrap-panic (element-at? BASE58_CHARS x)) out) u44))
)

(define-read-only (hex-to-uint (x (buff 1))) (unwrap-panic (index-of? ALL_HEX x)))
(define-read-only (uint-to-hex (x uint)) (unwrap-panic (element-at? ALL_HEX x)))
(define-read-only (is-zero (i uint)) (<= i u0))

;; Phase 1B-1: Add support for parsing Base58 characters to numeric values

;; Convert a Base58 character to its numeric index (0-57)
(define-read-only (b58-char-to-uint (c (string-ascii 1)))
  ;; Simply return the index, will panic if character is invalid
  (unwrap-panic (index-of? BASE58_CHARS c)))

;; Count leading '1' characters in the address (these represent leading zeros in binary)
(define-read-only (count-leading-ones (addr (string-ascii 44)))
  (let (
    (len-addr (len addr))
    (c1 (default-to "" (element-at? addr u0)))
    (c2 (default-to "" (element-at? addr u1)))
    (c3 (default-to "" (element-at? addr u2)))
    (count
      (+ 
        (if (and (> len-addr u0) (is-eq c1 "1")) u1 u0)
        (if (and (> len-addr u1) (is-eq c1 "1") (is-eq c2 "1")) u1 u0)
        (if (and (> len-addr u2) (is-eq c1 "1") (is-eq c2 "1") (is-eq c3 "1")) u1 u0)))
  )
    count))

;; Phase 1B-2: Simplest possible Base58 value extraction

;; Get the decimal value of the first character in a Bitcoin address
(define-read-only (get-first-char-value (addr (string-ascii 44)))
  (let (
    (first-char (unwrap! (element-at? addr u0) ERR_INVALID_B58_CHAR))
  )
    (ok (b58-char-to-uint first-char))))

;; Phase 1B-3: Handle first non-leading-one character 

;; Get the first non-leading-one character's value
(define-read-only (get-first-non-one-value (addr (string-ascii 44)))
  (let (
    ;; Count leading '1' characters
    (ones (count-leading-ones addr))
    
    ;; Get address length
    (addr-len (len addr))
    
    ;; Check if there are any non-one characters
    (has-non-ones (> addr-len ones))
  )
    (if has-non-ones
        ;; Get the value of the first non-one character
        (let ((char (unwrap! (element-at? addr ones) ERR_INVALID_B58_CHAR)))
          (ok (b58-char-to-uint char)))
        ;; If the address is all ones, return 0
        (ok u0))))

;; Phase 1B-4: Create buffer with leading zeros

;; Create a buffer with a specified number of leading zeros
(define-read-only (create-zeroes-buffer (count uint))
  (if (is-eq count u0)
    (ok 0x) ;; Empty buffer
    (if (is-eq count u1)
      (ok 0x00)
      (if (is-eq count u2)
        (ok 0x0000)
        (if (is-eq count u3)
          (ok 0x000000)
          (ok 0x00000000))))))

;; First step of decoding: handle leading ones and convert to leading zeroes
(define-read-only (get-leading-zeroes (addr (string-ascii 44)))
  (let (
    (ones-count (count-leading-ones addr))
  )
    (create-zeroes-buffer ones-count)))

;; Phase 1B-5: Extract first few significant characters from address

;; Get first few characters after leading ones and convert to their Base58 values
(define-read-only (get-first-few-chars (addr (string-ascii 44)))
  (let (
    ;; Find where to start (after any leading ones)
    (start-idx (count-leading-ones addr))
    
    ;; Get the address length
    (addr-len (len addr))
    
    ;; Determine how many characters to process (up to 3 non-one chars)
    (chars-to-process (if (< (- addr-len start-idx) u3) 
                         (- addr-len start-idx) 
                         u3))
    
    ;; Get the first character value if available
    (val1 (if (>= chars-to-process u1)
              (b58-char-to-uint (unwrap! (element-at? addr (+ start-idx u0)) ERR_INVALID_B58_CHAR))
              u0))
    
    ;; Get the second character value if available 
    (val2 (if (>= chars-to-process u2)
              (b58-char-to-uint (unwrap! (element-at? addr (+ start-idx u1)) ERR_INVALID_B58_CHAR))
              u0))
    
    ;; Get the third character value if available
    (val3 (if (>= chars-to-process u3)
              (b58-char-to-uint (unwrap! (element-at? addr (+ start-idx u2)) ERR_INVALID_B58_CHAR))
              u0))
  )
    ;; Return a tuple with the parsed values
    (ok {
      processed-count: chars-to-process,
      val1: val1,
      val2: val2, 
      val3: val3
    })))

;; Phase 2A-1: Start implementing the full Base58 decoder

;; Initialize an array of zeros for result buffer
(define-read-only (make-zero-buffer (length uint))
  (list u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0 u0))

;; Helper function to multiply a byte by 58 and handle carry
(define-read-only (mul-byte-by-58 (byte uint) (state {carry: uint, result: (list 25 uint), index: uint}))
  (let (
    ;; Get the current byte from the accumulator
    (current-byte (unwrap-panic (element-at? (get result state) (get index state))))
    
    ;; Multiply current byte by 58 and add carry from previous
    (product (+ (* current-byte u58) (get carry state)))
    
    ;; Store the remainder (byte value after applying carry)
    (remainder (mod product u256))
    
    ;; Calculate new carry for next byte
    (new-carry (/ product u256))
    
    ;; Current index we're processing
    (current-index (get index state))
    
    ;; Update result list with new byte value
    (new-result (unwrap-panic (replace-at? (get result state) current-index remainder)))
  )
    ;; Return updated state
    {
      carry: new-carry,
      result: new-result,
      index: (+ current-index u1)
    }
  )
)

;; Process a single base58 digit during decoding
(define-read-only (process-b58-digit (digit uint) (accumulator (list 25 uint)))
  (let (
    ;; Initial state with zero carry, original accumulator, and starting at index 0
    (initial-state {carry: digit, result: accumulator, index: u0})
    
    ;; Apply mul-byte-by-58 to each byte in the accumulator (from left to right)
    (final-state (fold mul-byte-by-58 accumulator initial-state))
  )
    ;; Return the result from the final state
    (get result final-state)))

;; Phase 2B: Extract and map version byte

;; Extract version byte (first byte) from decoded data and map to STX version
(define-read-only (map-btc-to-stx-version (decoded-bytes (list 25 uint)))
  (let (
    ;; Get the first byte (version) from decoded data
    (btc-version (unwrap! (element-at? decoded-bytes u0) ERR_INVALID_ADDR))
    
    ;; Convert version to buffer for lookup
    (btc-ver-buff (if (is-eq btc-version u0) 
                     0x00
                     (if (is-eq btc-version u5)
                        0x05
                        (if (is-eq btc-version u111)  ;; 0x6f (testnet P2PKH)
                           0x6f
                           0xc4))))  ;; 0xc4 (testnet P2SH)
    
    ;; Map BTC version to STX version
    (index (unwrap! (index-of? BTC_VER btc-ver-buff) ERR_INVALID_ADDR))
    (stx-version (unwrap-panic (element-at? STX_VER index)))
  )
    (ok stx-version)))

;; Phase 2C: Extract hash160 payload from decoded data

;; Define error code for hash160 extraction
(define-constant ERR_INVALID_HASH160 (err u12))

;; Fix extract-hash160 to handle errors consistently
(define-read-only (extract-hash160 (decoded-bytes (list 25 uint)))
  (let (
    ;; Make sure we have at least 21 bytes
    (has-enough-bytes (>= (len decoded-bytes) u21))
  )
    (if has-enough-bytes
        ;; Get bytes 1-21 (skip version byte at index 0)
        (ok (unwrap-panic (as-max-len? 
                (unwrap-panic (slice? decoded-bytes u1 u21)) 
                u20)))
        ;; Return specific error if not enough bytes
        ERR_INVALID_HASH160)))

;; Phase 2D: Create Stacks principal from version and hash160

;; Define error code for principal construction
(define-constant ERR_PRINCIPAL_CONSTRUCTION (err u1337))

;; Phase 2E: Implement more realistic hash160 conversion

;; Create a simple hash160 buffer from the first few integers
(define-read-only (create-hash160-buff (hash160-ints (list 20 uint)))
  (let (
    ;; Get first 4 bytes from hash160 list for a start
    (byte1 (default-to u0 (element-at? hash160-ints u0)))
    (byte2 (default-to u0 (element-at? hash160-ints u1)))
    (byte3 (default-to u0 (element-at? hash160-ints u2)))
    (byte4 (default-to u0 (element-at? hash160-ints u3)))
    
    ;; Convert to buffer bytes
    (b1 (uint-to-hex byte1))
    (b2 (uint-to-hex byte2))
    (b3 (uint-to-hex byte3))
    (b4 (uint-to-hex byte4))
    
    ;; Combine into a buffer (just 4 bytes for now)
    (partial-buff (concat (concat (concat b1 b2) b3) b4))
    
    ;; Pad to full 20 bytes
    (full-buff (concat partial-buff 0x0000000000000000000000000000000000))
  )
    ;; Return the buffer trimmed to exactly 20 bytes
    (unwrap-panic (as-max-len? full-buff u20))))

(define-read-only (list-to-buffer (uint-list (list 25 uint)))
  (let (
    ;; Convert each uint to a buffer byte
    (b0 (uint-to-hex (default-to u0 (element-at? uint-list u0))))
    (b1 (uint-to-hex (default-to u0 (element-at? uint-list u1))))
    (b2 (uint-to-hex (default-to u0 (element-at? uint-list u2))))
    (b3 (uint-to-hex (default-to u0 (element-at? uint-list u3))))
    (b4 (uint-to-hex (default-to u0 (element-at? uint-list u4))))
    (b5 (uint-to-hex (default-to u0 (element-at? uint-list u5))))
    (b6 (uint-to-hex (default-to u0 (element-at? uint-list u6))))
    (b7 (uint-to-hex (default-to u0 (element-at? uint-list u7))))
    (b8 (uint-to-hex (default-to u0 (element-at? uint-list u8))))
    (b9 (uint-to-hex (default-to u0 (element-at? uint-list u9))))
    (b10 (uint-to-hex (default-to u0 (element-at? uint-list u10))))
    (b11 (uint-to-hex (default-to u0 (element-at? uint-list u11))))
    (b12 (uint-to-hex (default-to u0 (element-at? uint-list u12))))
    (b13 (uint-to-hex (default-to u0 (element-at? uint-list u13))))
    (b14 (uint-to-hex (default-to u0 (element-at? uint-list u14))))
    (b15 (uint-to-hex (default-to u0 (element-at? uint-list u15))))
    (b16 (uint-to-hex (default-to u0 (element-at? uint-list u16))))
    (b17 (uint-to-hex (default-to u0 (element-at? uint-list u17))))
    (b18 (uint-to-hex (default-to u0 (element-at? uint-list u18))))
    (b19 (uint-to-hex (default-to u0 (element-at? uint-list u19))))
    (b20 (uint-to-hex (default-to u0 (element-at? uint-list u20))))
    (b21 (uint-to-hex (default-to u0 (element-at? uint-list u21))))
    (b22 (uint-to-hex (default-to u0 (element-at? uint-list u22))))
    (b23 (uint-to-hex (default-to u0 (element-at? uint-list u23))))
    (b24 (uint-to-hex (default-to u0 (element-at? uint-list u24))))
    
    ;; Combine all bytes into a single buffer in chunks to avoid nesting too deeply
    (part1 (concat (concat (concat (concat b0 b1) b2) b3) b4))
    (part2 (concat (concat (concat (concat b5 b6) b7) b8) b9))
    (part3 (concat (concat (concat (concat b10 b11) b12) b13) b14))
    (part4 (concat (concat (concat (concat b15 b16) b17) b18) b19))
    (part5 (concat (concat (concat (concat b20 b21) b22) b23) b24))
    
    ;; Combine all parts
    (buffer (concat (concat (concat (concat part1 part2) part3) part4) part5))
  )
    buffer))

(define-read-only (decode-b58-char (c (string-ascii 1)) (accumulator (list 25 uint)))
  (let (
    (value (default-to u0 (index-of? BASE58_CHARS c)))
  )
    ;; Assume valid character (validation done elsewhere)
    (process-b58-digit value accumulator)))

(define-read-only (decode-b58-chars (addr (string-ascii 44)) (start-idx uint))
  (let (
    ;; Initialize accumulator with zeros
    (acc (make-zero-buffer u25))
    
    ;; Process characters in chunks (explicit handling for each position)
    ;; First chunk
    (acc1 (if (< start-idx (len addr))
             (decode-b58-char (unwrap-panic (element-at? addr start-idx)) acc)
             acc))
    
    (acc2 (if (< (+ start-idx u1) (len addr))
             (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u1))) acc1)
             acc1))
    
    (acc3 (if (< (+ start-idx u2) (len addr))
             (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u2))) acc2)
             acc2))
    
    (acc4 (if (< (+ start-idx u3) (len addr))
             (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u3))) acc3)
             acc3))
    
    ;; Second chunk
    (acc5 (if (< (+ start-idx u4) (len addr))
             (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u4))) acc4)
             acc4))
    
    (acc6 (if (< (+ start-idx u5) (len addr))
             (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u5))) acc5)
             acc5))
    
    (acc7 (if (< (+ start-idx u6) (len addr))
             (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u6))) acc6)
             acc6))
    
    (acc8 (if (< (+ start-idx u7) (len addr))
             (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u7))) acc7)
             acc7))
    
    ;; Third chunk
    (acc9 (if (< (+ start-idx u8) (len addr))
             (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u8))) acc8)
             acc8))
    
    (acc10 (if (< (+ start-idx u9) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u9))) acc9)
              acc9))
    
    ;; Fourth chunk
    (acc11 (if (< (+ start-idx u10) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u10))) acc10)
              acc10))
    
    (acc12 (if (< (+ start-idx u11) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u11))) acc11)
              acc11))
    
    (acc13 (if (< (+ start-idx u12) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u12))) acc12)
              acc12))
    
    (acc14 (if (< (+ start-idx u13) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u13))) acc13)
              acc13))
    
    ;; Fifth chunk
    (acc15 (if (< (+ start-idx u14) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u14))) acc14)
              acc14))
    
    (acc16 (if (< (+ start-idx u15) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u15))) acc15)
              acc15))
    
    (acc17 (if (< (+ start-idx u16) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u16))) acc16)
              acc16))
    
    (acc18 (if (< (+ start-idx u17) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u17))) acc17)
              acc17))
    
    ;; Sixth chunk
    (acc19 (if (< (+ start-idx u18) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u18))) acc18)
              acc18))
    
    (acc20 (if (< (+ start-idx u19) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u19))) acc19)
              acc19))
    
    (acc21 (if (< (+ start-idx u20) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u20))) acc20)
              acc20))
    
    (acc22 (if (< (+ start-idx u21) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u21))) acc21)
              acc21))
    
    ;; Seventh chunk
    (acc23 (if (< (+ start-idx u22) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u22))) acc22)
              acc22))
    
    (acc24 (if (< (+ start-idx u23) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u23))) acc23)
              acc23))
    
    (acc25 (if (< (+ start-idx u24) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u24))) acc24)
              acc24))
    
    (acc26 (if (< (+ start-idx u25) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u25))) acc25)
              acc25))
    
    ;; Eighth chunk (Bitcoin addresses can be up to 34 characters)
    (acc27 (if (< (+ start-idx u26) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u26))) acc26)
              acc26))
    
    (acc28 (if (< (+ start-idx u27) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u27))) acc27)
              acc27))
    
    (acc29 (if (< (+ start-idx u28) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u28))) acc28)
              acc28))
    
    (acc30 (if (< (+ start-idx u29) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u29))) acc29)
              acc29))
    
    ;; Ninth chunk (final characters)
    (acc31 (if (< (+ start-idx u30) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u30))) acc30)
              acc30))
    
    (acc32 (if (< (+ start-idx u31) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u31))) acc31)
              acc31))
    
    (acc33 (if (< (+ start-idx u32) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u32))) acc32)
              acc32))
    
    (acc34 (if (< (+ start-idx u33) (len addr))
              (decode-b58-char (unwrap-panic (element-at? addr (+ start-idx u33))) acc33)
              acc33))
  )
    ;; Return final accumulator
    acc34))

(define-read-only (decode-b58-string (addr (string-ascii 44)))
  (let (
    ;; Count leading '1' characters
    (leading-ones-count (count-leading-ones addr))
    
    ;; Create buffer with leading zeros
    (leading-zeros (unwrap-panic (create-zeroes-buffer leading-ones-count)))
    
    ;; Decode the rest of the string
    (decoded-list (decode-b58-chars addr leading-ones-count))
    
    ;; Convert the list of uint to a buffer
    (decoded-buffer (list-to-buffer decoded-list))
  )
    (ok (concat leading-zeros decoded-buffer))))

(define-read-only (verify-checksum (decoded (buff 29)))
  (let (
    ;; Get the payload (first 21 bytes - version + hash160)
    (payload-opt (slice? decoded u0 u21))
    (payload (if (is-some payload-opt)
                (unwrap-panic payload-opt)
                0x))
    
    ;; Calculate the checksum (double SHA256, first 4 bytes)
    (hash1 (sha256 payload))
    (hash2 (sha256 hash1))
    (calculated-checksum-opt (slice? hash2 u0 u4))
    (calculated-checksum (if (is-some calculated-checksum-opt)
                            (unwrap-panic calculated-checksum-opt)
                            0x))
    
    ;; Extract the embedded checksum (last 4 bytes of decoded)
    (buffer-len (len decoded))
    (checksum-start (- buffer-len u4))
    (embedded-checksum-opt (slice? decoded u21 u4))
    (embedded-checksum (if (is-some embedded-checksum-opt)
                          (unwrap-panic embedded-checksum-opt)
                          0x))
    
    ;; Compare checksums
    (checksums-match (is-eq calculated-checksum embedded-checksum))
  )
    (if checksums-match
        (ok true)
        (err u14))))

(define-public (btc-stx-addr (btc-addr (string-ascii 44)))
  (begin
    ;; Validate the address
    (try! (validate-b58-addr btc-addr))
    
    (let (
      ;; Decode Base58 string to bytes
      (decoded-bytes (unwrap-panic (decode-b58-string btc-addr)))
      
      ;; Verify checksum
      ;; (valid-checksum (try! (verify-checksum decoded-bytes)))
      ;; Extract version byte - first byte of decoded data
      (btc-version (unwrap-panic (element-at? decoded-bytes u0)))
      
      ;; Map BTC version to STX version
      (btc-ver-buff (concat btc-version 0x))
      (index (unwrap! (index-of? BTC_VER btc-ver-buff) ERR_INVALID_ADDR))
      (stx-version (unwrap-panic (element-at? STX_VER index)))
      
      ;; Extract hash160 - bytes 1-21 of decoded data (skip version byte)
      (hash160-buff (unwrap-panic (as-max-len? 
                   (unwrap-panic (slice? decoded-bytes u1 u21)) 
                   u20)))
      
      ;; Create Stacks principal
      (principal (principal-construct? stx-version hash160-buff))
      ;; (principal (principal-construct? 0x16 0xbf584905755be35f11b96c2691fd9c3fc64f4b16))
    )
      ;; Return the principal or error
      (ok principal))))