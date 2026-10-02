;; Local-only traits for repo contracts that are not deployed as-is (on-chain charisma-traits-v1 has no vault-trait).

(define-trait vault-trait (
  (execute 
    (uint (optional (buff 16))) 
    (response (tuple (dx uint) (dy uint) (dk uint)) uint))))
