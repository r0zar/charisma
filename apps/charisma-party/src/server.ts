import PricesParty from "./parties/prices";
import BalancesParty from "./parties/balances";

// Default export for main entry point
export default PricesParty;

// Named exports for parties configuration
export { default as prices } from "./parties/prices";
export { default as balances } from "./parties/balances";