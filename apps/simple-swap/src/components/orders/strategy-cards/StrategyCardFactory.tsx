"use client";

import React from 'react';
import { StrategyDisplayData } from '@/lib/orders/strategy-formatter';
import { BaseStrategyCardProps } from './base/shared-types';
import { detectStrategyType } from './utils/strategy-detector';
import { SingleOrderCard } from './types/SingleOrderCard';
import { DCAStrategyCard } from './types/DCAStrategyCard';
import { TwitterStrategyCard } from './types/TwitterStrategyCard';

/**
 * Factory component that renders the appropriate strategy card based on the strategy type
 * This is the single source of truth for strategy card component selection
 */
export const StrategyCardFactory: React.FC<BaseStrategyCardProps> = (props) => {
    const { strategyData } = props;
    const strategyType = detectStrategyType(strategyData);

    switch (strategyType) {
        case 'single':
            return <SingleOrderCard {...props} strategyData={strategyData as StrategyDisplayData & { type: 'single' }} />;
        case 'dca':
            return <DCAStrategyCard {...props} strategyData={strategyData as StrategyDisplayData & { type: 'dca' }} />;
        case 'twitter':
            return <TwitterStrategyCard {...props} strategyData={strategyData as StrategyDisplayData & { type: 'twitter' }} />;
        default:
            // This should never happen with our current types, but provides a fallback
            console.warn('Unknown strategy type:', strategyType, 'falling back to SingleOrderCard');
            return <SingleOrderCard {...props} strategyData={strategyData as StrategyDisplayData & { type: 'single' }} />;
    }
};

/**
 * Higher-order component for extending the factory with new strategy types
 * This makes it easy to add new strategy types in the future
 */
interface StrategyComponentRegistry {
    single: React.ComponentType<any>;
    dca: React.ComponentType<any>;
    twitter: React.ComponentType<any>;
}

const defaultRegistry: StrategyComponentRegistry = {
    single: SingleOrderCard,
    dca: DCAStrategyCard,
    twitter: TwitterStrategyCard,
};

/**
 * Creates a strategy card factory with a custom component registry
 * Useful for testing or extending with additional strategy types
 */
export function createStrategyCardFactory(
    registry: Partial<StrategyComponentRegistry> = {}
): React.FC<BaseStrategyCardProps> {
    const componentRegistry = { ...defaultRegistry, ...registry };

    return (props: BaseStrategyCardProps) => {
        const { strategyData } = props;
        const strategyType = detectStrategyType(strategyData);
        const Component = componentRegistry[strategyType];

        if (!Component) {
            console.warn('No component registered for strategy type:', strategyType);
            return <SingleOrderCard {...props} strategyData={strategyData as StrategyDisplayData & { type: 'single' }} />;
        }

        return <Component {...props} />;
    };
}