import { StrategyDisplayData } from '@/lib/orders/strategy-formatter';

/**
 * Common props shared by all strategy card components
 */
export interface BaseStrategyCardProps {
    strategyData: StrategyDisplayData;
    currentPrices: Map<string, number>;
    isRecentlyUpdated: boolean;
    expandedStrategies: Set<string>;
    expandedRow: string | null;
    onToggleExpansion: (strategyId: string) => void;
    onToggleRowExpansion: (uuid: string) => void;
    onCopyToClipboard: (text: string, id: string) => void;
    onExecuteNow: (uuid: string) => void;
    onCancelOrder: (uuid: string) => void;
    copiedId: string | null;
    formatTokenAmount: (amount: string | number, decimals: number) => string;
}

/**
 * Props specific to single order cards
 */
export interface SingleOrderCardProps extends BaseStrategyCardProps {
    strategyData: StrategyDisplayData & { type: 'single' };
}

/**
 * Props specific to DCA strategy cards
 */
export interface DCAStrategyCardProps extends BaseStrategyCardProps {
    strategyData: StrategyDisplayData & { type: 'dca' };
}

/**
 * Props specific to Twitter strategy cards
 */
export interface TwitterStrategyCardProps extends BaseStrategyCardProps {
    strategyData: StrategyDisplayData & { type: 'twitter' };
}

/**
 * Union type for all strategy card component props
 */
export type StrategyCardProps = SingleOrderCardProps | DCAStrategyCardProps | TwitterStrategyCardProps;