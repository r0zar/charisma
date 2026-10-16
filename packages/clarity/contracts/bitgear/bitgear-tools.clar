;; Title: bitgear tools
;; Description: Helpers for the original bitgear contract (SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.bitgear-genesis).
;;   mint-many mints a batch of ids to the caller: free for bitgear's deployer, anyone else pays bitgear's price.
;;   refresh-metadata asks NFT indexers to re-read bitgear's metadata (SIP-019); indexers honor it from bitgear's deployer.

;; Each result is (ok id) for a mint, or (err code) for an id that wasn't minted (e.g. already minted)
(define-public (mint-many (ids (list 1000 uint)))
    (ok (map mint-one ids)))

(define-private (mint-one (id uint))
    (contract-call? 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.bitgear-genesis claim id))

(define-public (refresh-metadata)
    (ok (print {
        notification: "token-metadata-update",
        payload: { token-class: "nft", contract-id: 'SP2D5BGGJ956A635JG7CJQ59FTRFRB0893514EZPJ.bitgear-genesis }
    })))
