"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { BaseStrategyCardProps } from './shared-types';

interface BaseStrategyCardLayoutProps extends BaseStrategyCardProps {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
}

/**
 * Base layout component that provides shared styling and behavior for all strategy cards
 */
export const BaseStrategyCard: React.FC<BaseStrategyCardLayoutProps> = ({
    strategyData,
    isRecentlyUpdated,
    children,
    onClick
}) => {
    return (
        <div
            className={cn(
 "group relative rounded-2xl border transition-all duration-300 cursor-pointer",
                isRecentlyUpdated
                    ? 'border-success/[0.3] bg-success-soft shadow-emerald-500/[0.1] ring-1 ring-success/[0.2]'
                    : 'border-line bg-surface hover:bg-chrome hover:border-line-strong',
                "backdrop-blur-sm"
            )}
            onClick={onClick}
        >
            {/* Subtle gradient overlay */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-surface-sunken to-transparent pointer-events-none" />

            {/* Recently Updated Indicator */}
            {isRecentlyUpdated && (
                <>
                    <div className="absolute top-3 right-3 w-2 h-2 bg-success rounded-full animate-ping z-10" />
                    <div className="absolute top-3 right-3 w-2 h-2 bg-success rounded-full z-10" />
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-success to-blaze animate-pulse z-10 rounded-t-2xl" />
                </>
            )}

            {/* Content */}
            <div className="relative p-3 sm:p-6 space-y-4">
                {children}
            </div>
        </div>
    );
};