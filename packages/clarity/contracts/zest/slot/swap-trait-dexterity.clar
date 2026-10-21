;; Dexterity slot for Zest Stacks Swap routers: the router hands the adapter the pool itself,
;; so one adapter serves every Dexterity (Charisma) pool.
(use-trait ft-trait 'SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST.sip010-trait.sip010-trait)
(use-trait dexterity-pool 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0.liquidity-pool-trait)
(define-trait swap-trait-dexterity
  (
    (swap-leg (<dexterity-pool> bool bool bool <ft-trait> <ft-trait> uint uint) (response uint uint))
  )
)
