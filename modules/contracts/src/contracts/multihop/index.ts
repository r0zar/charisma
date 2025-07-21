// Export the main Multihop class
export { Multihop } from './Multihop';

// Export the Router class for advanced use cases
export { Router } from './Router';

// Export all types and interfaces
export type {
  VaultOperation,
  MultihopConfig,
  Route,
  RouteHop,
  GraphEdge,
  GraphNode,
  CachedQuote
} from './types';

// Export constants
export { defaultMultihopConfig, OPCODES } from './types';