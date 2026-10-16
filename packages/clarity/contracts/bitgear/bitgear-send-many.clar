;; Title: bitgear send-many
;; Description: Sends many bitgear (SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.bitgear-genesis) from the caller in one transaction.
;;   bitgear's transfer checks tx-sender, so this only moves pieces the signer owns.
;;   All or nothing: if any piece can't be sent, nothing is sent.

(define-public (send-many (gifts (list 200 { id: uint, to: principal })))
    (fold check-err (map send-one gifts) (ok true)))

(define-private (send-one (gift { id: uint, to: principal }))
    (contract-call? 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.bitgear-genesis transfer (get id gift) tx-sender (get to gift)))

(define-private (check-err (result (response bool uint)) (prior (response bool uint)))
    (match prior ok-value result err-value (err err-value)))
