;; title: blaze-v2
;; author: rozar.btc
;; summary: blaze-v1's SIP-018 intent verifier, plus bearer notes that can't be front-run, replay protection a stranger
;;   can't spend on your behalf, and a way to cancel your own signed intents for good. See BLAZE-V2.md.
;;
;; Intents hash the same tuple as v1 ({contract, intent, opcode, amount, target, uuid}); only the domain version
;; changes, so a v1 signature can never be replayed here.

(define-constant structured-data-prefix 0x534950303138)
(define-constant message-domain {name: "BLAZE_PROTOCOL", version: "v2.0", chain-id: chain-id})
(define-constant message-domain-hash (sha256 (unwrap-panic (to-consensus-buff? message-domain))))
(define-constant structured-data-header (concat structured-data-prefix message-domain-hash))

(define-constant ERR_INVALID_SIGNATURE (err u401000))
(define-constant ERR_NOT_DIRECT        (err u403001))
(define-constant ERR_CONSENSUS_BUFF    (err u422000))
(define-constant ERR_UUID_SUBMITTED    (err u409000))

;; v1 keyed this by uuid alone and wrote it before checking the signature, so anyone could burn someone else's
;; uuid with a junk signature. v2 records (signer, uuid) once the signature checks out: a junk signature recovers a
;; random principal and only ever spends that principal's uuid.
(define-map submitted {signer: principal, uuid: (string-ascii 36)} bool)

;; ---------------------------------------------------------------------------------------------
;; Hashing
;; ---------------------------------------------------------------------------------------------

(define-read-only (hash
    (contract principal)
    (intent   (string-ascii 32))
    (opcode   (optional (buff 16)))
    (amount   (optional uint))
    (target   (optional principal))
    (uuid     (string-ascii 36))
  )
  (ok (sha256 (concat structured-data-header (sha256
    (unwrap! (to-consensus-buff? {
      contract: contract,
      intent: intent,
      opcode: opcode,
      amount: amount,
      target: target,
      uuid: uuid
    }) ERR_CONSENSUS_BUFF)
  ))))
)

;; What a note's key signs to redeem it: "pay note <uuid> on <contract> to <to>"
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
;; Intents (called by subnet contracts, which then move the signer's balance)
;; ---------------------------------------------------------------------------------------------

(define-public (execute
    (signature (buff 65))
    (intent    (string-ascii 32))
    (opcode    (optional (buff 16)))
    (amount    (optional uint))
    (target    (optional principal))
    (uuid      (string-ascii 36))
  )
  (let ((signer (try! (verify (try! (hash contract-caller intent opcode amount target uuid)) signature))))
    (asserts! (map-insert submitted {signer: signer, uuid: uuid} true) ERR_UUID_SUBMITTED)
    (ok signer)
  )
)

;; ---------------------------------------------------------------------------------------------
;; Bearer notes: paper cash
;; ---------------------------------------------------------------------------------------------
;; Issue (off-chain): make a fresh key pair per note and print its private key under the scratch-off. The issuer signs
;; the ordinary intent hash(subnet, "REDEEM_NOTE", none, some amount, some <the note key's address>, uuid).
;; Redeem: the holder signs hash-claim(subnet, uuid, to) with the note key, and submits both signatures.
;; A copy taken from the mempool can't change `to`: that needs the note key, which never goes on-chain.
;; Called by a subnet contract, which then moves `amount` from the returned issuer to `to`.
(define-public (redeem-note
    (issuer-signature (buff 65))
    (note-signature   (buff 65))
    (amount           uint)
    (to               principal)
    (uuid             (string-ascii 36))
  )
  (let (
      (note (try! (verify (try! (hash-claim contract-caller uuid to)) note-signature)))
      (issuer (try! (verify (try! (hash contract-caller "REDEEM_NOTE" none (some amount) (some note) uuid)) issuer-signature)))
    )
    (asserts! (map-insert submitted {signer: issuer, uuid: uuid} true) ERR_UUID_SUBMITTED)
    (print {event: "redeem-note", issuer: issuer, note: note, to: to, amount: amount, uuid: uuid})
    (ok issuer)
  )
)

;; ---------------------------------------------------------------------------------------------
;; Cancel for good
;; ---------------------------------------------------------------------------------------------
;; Spend one of your own uuids so no intent you signed with it can ever execute. Only a direct call counts, so a
;; contract you interact with can't cancel your orders behind your back.
(define-public (revoke (uuid (string-ascii 36)))
  (begin
    (asserts! (is-eq tx-sender contract-caller) ERR_NOT_DIRECT)
    (asserts! (map-insert submitted {signer: tx-sender, uuid: uuid} true) ERR_UUID_SUBMITTED)
    (print {event: "revoke", signer: tx-sender, uuid: uuid})
    (ok true)
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
    (uuid      (string-ascii 36))
  )
  (verify (try! (hash contract intent opcode amount target uuid)) signature)
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

;; Has this signer already used (or revoked) this uuid?
(define-read-only (check (signer principal) (uuid (string-ascii 36)))
  (is-some (map-get? submitted {signer: signer, uuid: uuid}))
)
