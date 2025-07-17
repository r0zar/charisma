// === THREE-ENGINE ARCHITECTURE ===

// Core types and interfaces
export * from './shared/types';

// Shared utilities
export * from './shared/decimal-utils';

// Three engines
export { OracleEngine } from './engines/oracle-engine';
export { CpmmEngine } from './engines/cpmm-engine';
export { VirtualEngine } from './engines/virtual-engine';

// LP token support for virtual engine
export * from './engines/lp-token-calculator';
export * from './engines/lp-dependency-graph';
export * from './engines/lp-processing-queue';

// Orchestrator (main interface)
export { PriceServiceOrchestrator } from './orchestrator/price-service-orchestrator';

// Price series (public API layer)
export { PriceSeriesStorage } from './price-series/price-series-storage';
export { PriceSeriesAPI } from './price-series/price-series-api';
export { PriceUpdateScheduler } from './price-series/price-update-scheduler';

// === ADAPTERS (for backward compatibility) ===

// Legacy adapters that wrap the new three-engine architecture
export * from './adapters';

// Legacy type exports
export type { VaultLiquidityProvider } from './engines/lp-token-calculator';