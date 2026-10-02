;; title: blaze-v2 (DRAFT, not deployed)
;; author: rozar.btc
;; summary: blaze-v1's SIP-018 verifier, plus bearer-key notes that can't be front-run, and replay
;;   protection that a stranger can't spend on your behalf. See BLAZE-V2.md.

(define-constant structured-data-prefix 0x534950303138)
(define-constant message-domain {name: "BLAZE_PROTOCOL", version: "v2.0", chain-id: chain-id})
(define-constant message-domain-hash (sha256 (unwrap-panic (to-consensus-buff? message-domain))))
(define-constant structured-data-header (concat structured-data-prefix message-domain-hash))

(define-constant ERR_INVALID_SIGNATURE (err u401000))
(define-constant ERR_WRONG_NOTE_KEY    (err u403000))
(define-constant ERR_CONSENSUS_BUFF    (err u422000))
(define-constant ERR_UUID_SUBMITTED    (err u409000))

;; v1 keyed this by uuid alone and wrote it before checking the signature, so anyone could burn
;; someone else's uuid with a junk signature. v2 records (signer, uuid) after the signature checks out:
;; a junk signature recovers a random principal and only ever spends that principal's uuid.
(define-map submitted {signer: principal, uuid: (string-ascii 36)} bool)

;; ---------------------------------------------------------------------------------------------
;; Hashing
;; ---------------------------------------------------------------------------------------------

;; Same shape as v1 plus `bearer`: the compressed public key of a note's key, or none for plain intents
(define-read-only (hash
    (contract principal)
    (intent   (string-ascii 32))
    (opcode   (optional (buff 16)))
    (amount   (optional uint))
    (target   (optional principal))
    (bearer   (optional (buff 33)))
    (uuid     (string-ascii 36))
  )
  (ok (sha256 (concat structured-data-header (sha256
    (unwrap! (to-consensus-buff? {
      contract: contract,
      intent: intent,
      opcode: opcode,
      amount: amount,
      target: target,
      bearer: bearer,
      uuid: uuid
    }) ERR_CONSENSUS_BUFF)
  ))))
)

;; What a note's key signs when someone redeems it: "pay note <uuid> on <contract> to <to>"
(define-read-only (hash-claim
    (contract principal)
    (uuid     (string-ascii 36))
    (to       principal)
  )
  (ok (sha256 (concat structured-data-header (sha256
    (unwrap! (to-consensus-buff? {contract: contract, claim: uuid, to: to}) ERR_CONSENSUS_BUFF)
  ))))
)

;; ---------------------------------------------------------------------------------------------
;; Plain intents (v1 behaviour, called by subnet contracts)
;; ---------------------------------------------------------------------------------------------

(define-public (execute
    (signature (buff 65))
    (intent    (string-ascii 32))
    (opcode    (optional (buff 16)))
    (amount    (optional uint))
    (target    (optional principal))
    (uuid      (string-ascii 36))
  )
  (let ((signer (try! (verify (try! (hash contract-caller intent opcode amount target none uuid)) signature))))
    (asserts! (map-insert submitted {signer: signer, uuid: uuid} true) ERR_UUID_SUBMITTED)
    (ok signer)
  )
)

;; ---------------------------------------------------------------------------------------------
;; Bearer-key notes
;; ---------------------------------------------------------------------------------------------
;; Issue (off-chain): make a fresh key pair per note, print its private key under the scratch-off, and have
;; the issuer sign hash(subnet, "REDEEM_NOTE", none, some amount, none, some <note public key>, uuid).
;; Redeem: the holder signs hash-claim(subnet, uuid, to) with the note key and submits both signatures.
;; A copy taken from the mempool can't change `to`: that needs the note key, which never goes on-chain.
;; Called by a subnet contract, which then moves `amount` from the returned issuer to `to`.
(define-public (redeem-note
    (issuer-signature (buff 65))
    (note-signature   (buff 65))
    (amount           uint)
    (bearer           (buff 33))
    (to               principal)
    (uuid             (string-ascii 36))
  )
  (let (
      (issuer (try! (verify (try! (hash contract-caller "REDEEM_NOTE" none (some amount) none (some bearer) uuid)) issuer-signature)))
      (note-key (unwrap! (secp256k1-recover? (try! (hash-claim contract-caller uuid to)) note-signature) ERR_INVALID_SIGNATURE))
    )
    (asserts! (is-eq note-key bearer) ERR_WRONG_NOTE_KEY)
    (asserts! (map-insert submitted {signer: issuer, uuid: uuid} true) ERR_UUID_SUBMITTED)
    (print {event: "redeem-note", issuer: issuer, to: to, amount: amount, uuid: uuid})
    (ok issuer)
  )
)

;; ---------------------------------------------------------------------------------------------
;; Read-only helpers
;; ---------------------------------------------------------------------------------------------

(define-read-only (recover
    (signature (buff 65))
    (contract  principal)
    (intent    (string-ascii 32))
    (opcode    (optional (buff 16)))
    (amount    (optional uint))
    (target    (optional principal))
    (bearer    (optional (buff 33)))
    (uuid      (string-ascii 36))
  )
  (verify (try! (hash contract intent opcode amount target bearer uuid)) signature)
)

(define-read-only (verify
    (message   (buff 32))
    (signature (buff 65))
  )
  (match (secp256k1-recover? message signature)
    public-key (principal-of? public-key)
    error ERR_INVALID_SIGNATURE
  )
)

;; Has this signer already used this uuid?
(define-read-only (check (signer principal) (uuid (string-ascii 36)))
  (is-some (map-get? submitted {signer: signer, uuid: uuid}))
)
