;; DungeonMaster is the fun DAO to rule them all.

(use-trait proposal-trait .charisma-traits-v1.proposal-trait)
(use-trait extension-trait .charisma-traits-v1.extension-trait)

(define-constant err-unauthorized (err u1000))
(define-constant err-already-executed (err u1001))
(define-constant err-invalid-extension (err u1002))

(define-data-var executive principal tx-sender)
(define-map executed-proposals principal uint)
(define-map extensions principal bool)

(map-set extensions .dungeon-keeper true)

;; --- Authorization check

(define-private (is-self-or-extension)
	(ok (asserts! (or (is-eq tx-sender (as-contract tx-sender)) (is-extension contract-caller)) err-unauthorized))
)

;; --- Extensions

(define-read-only (is-extension (extension principal))
	(default-to false (map-get? extensions extension))
)

(define-public (set-extension (extension principal) (enabled bool))
	(begin
		(try! (is-self-or-extension))
		(print {event: "extension", extension: extension, enabled: enabled})
		(ok (map-set extensions extension enabled))
	)
)

(define-private (set-extensions-iter (item {extension: principal, enabled: bool}))
	(begin
		(print {event: "extension", extension: (get extension item), enabled: (get enabled item)})
		(map-set extensions (get extension item) (get enabled item))
	)
)

(define-public (set-extensions (extension-list (list 200 {extension: principal, enabled: bool})))
	(begin
		(try! (is-self-or-extension))
		(ok (map set-extensions-iter extension-list))
	)
)

;; --- Proposals

(define-read-only (executed-at (proposal <proposal-trait>))
	(map-get? executed-proposals (contract-of proposal))
)

(define-public (execute (proposal <proposal-trait>) (sender principal))
	(begin
		(try! (is-self-or-extension))
		(asserts! (map-insert executed-proposals (contract-of proposal) burn-block-height) err-already-executed)
		(print {event: "execute", proposal: proposal})
		(as-contract (contract-call? proposal execute sender))
	)
)

;; --- Bootstrap

(define-public (construct (proposal <proposal-trait>))
	(let ((sender tx-sender))
		(asserts! (is-eq sender (var-get executive)) err-unauthorized)
		(var-set executive (as-contract tx-sender))
		(as-contract (execute proposal sender))
	)
)

;; --- Extension requests

(define-public (request-extension-callback (extension <extension-trait>) (memo (buff 34)))
	(let ((sender tx-sender))
		(asserts! (is-extension contract-caller) err-invalid-extension)
		(asserts! (is-eq contract-caller (contract-of extension)) err-invalid-extension)
		(as-contract (contract-call? extension callback sender memo))
	)
)