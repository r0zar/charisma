// Public exports for the strategy cards module
export { StrategyCardFactory } from './StrategyCardFactory';
export type { BaseStrategyCardProps, SingleOrderCardProps, DCAStrategyCardProps, RangeStrategyCardProps, StrategyCardProps } from './base/shared-types';
export { SingleOrderCard } from './types/SingleOrderCard';
export { DCAStrategyCard } from './types/DCAStrategyCard';
export { RangeStrategyCard } from './types/RangeStrategyCard';
export { detectStrategyType, isSingleOrderStrategy, isDCAStrategy, isRangeStrategy } from './utils/strategy-detector';