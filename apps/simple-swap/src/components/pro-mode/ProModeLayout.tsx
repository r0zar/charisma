"use client";

import React, { useEffect } from 'react';
import { ProModeProvider, useProModeContext } from '../../contexts/pro-mode-context';
import { useSwapContext } from '../../contexts/swap-context';
import OrderTypeSelector from './OrderTypeSelector';
import ProModeHeader from './ProModeHeader';
import ProModeChart from './ProModeChart';
import OrderControls from './OrderControls';
import OrdersSidebar from './OrdersSidebar';
import TokenSelectionDialog from './TokenSelectionDialog';

function ProModeLayoutContent() {
    const {
        tokenSelectionState,
        closeTokenSelection,
        selectedOrderType,
        setSelectedOrderType,
        targetPrice,
        setTargetPrice,
        conditionDir,
        setConditionDir,
        clearHighlightedOrder,
        handleCreateLimitOrder,
        handleCreateDcaOrder,
        handleCreateSandwichOrder,
        sandwichSpread,
        setSandwichSpread,
        handlePriceChange,
        handleSandwichSpreadChange,
        leftSidebarCollapsed,
        rightSidebarCollapsed,
        toggleLeftSidebar,
        toggleRightSidebar,
    } = useProModeContext();

    const {
        setIsProMode,
        handleSwitchTokensEnhanced,
    } = useSwapContext();

    // Note: Margin account syncing now handled by backend API

    // Keyboard event handler
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Don't handle hotkeys if user is typing in an input field
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement ||
                (event.target as HTMLElement).isContentEditable
            ) {
                return;
            }

            // Handle different key combinations
            switch (event.key) {
                case 'Escape':
                    event.preventDefault();
                    setIsProMode(false);
                    break;



                case 'Tab':
                    event.preventDefault();
                    if (event.shiftKey) {
                        // Reverse cycle through order types: single -> sandwich -> dca -> single
                        if (selectedOrderType === 'single') {
                            setSelectedOrderType('sandwich');
                        } else if (selectedOrderType === 'sandwich') {
                            setSelectedOrderType('dca');
                        } else {
                            setSelectedOrderType('single');
                        }
                    } else {
                        // Forward cycle through order types: single -> dca -> sandwich -> single
                        if (selectedOrderType === 'single') {
                            setSelectedOrderType('dca');
                        } else if (selectedOrderType === 'dca') {
                            setSelectedOrderType('sandwich');
                        } else {
                            setSelectedOrderType('single');
                        }
                    }
                    break;

                case 'Enter':
                    event.preventDefault();
                    // Submit current order based on selected type
                    if (selectedOrderType === 'single') {
                        handleCreateLimitOrder();
                    } else if (selectedOrderType === 'dca') {
                        handleCreateDcaOrder();
                    } else if (selectedOrderType === 'sandwich') {
                        handleCreateSandwichOrder();
                    }
                    break;

                case 's':
                case 'S':
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        handleSwitchTokensEnhanced();
                    }
                    break;

                case 'ArrowUp':
                    event.preventDefault();
                    if (selectedOrderType === 'sandwich') {
                        // Adjust spread in sandwich mode
                        const currentSpread = parseFloat(sandwichSpread) || 0;
                        let increment = 0.1;
                        if (event.shiftKey) increment = 1;
                        if (event.ctrlKey || event.metaKey) increment = 5;
                        handleSandwichSpreadChange((currentSpread + increment).toString());
                    } else {
                        // Adjust price
                        const currentPrice = parseFloat(targetPrice) || 0;
                        let increment = 0.01;
                        if (event.shiftKey) increment = 0.1;
                        if (event.ctrlKey || event.metaKey) increment = 1;
                        handlePriceChange((currentPrice + increment).toString());
                    }
                    break;

                case 'ArrowDown':
                    event.preventDefault();
                    if (selectedOrderType === 'sandwich') {
                        // Adjust spread in sandwich mode
                        const currentSpread = parseFloat(sandwichSpread) || 0;
                        let decrement = 0.1;
                        if (event.shiftKey) decrement = 1;
                        if (event.ctrlKey || event.metaKey) decrement = 5;
                        const newSpread = Math.max(0, currentSpread - decrement);
                        handleSandwichSpreadChange(newSpread.toString());
                    } else {
                        // Adjust price
                        const currentPrice = parseFloat(targetPrice) || 0;
                        let decrement = 0.01;
                        if (event.shiftKey) decrement = 0.1;
                        if (event.ctrlKey || event.metaKey) decrement = 1;
                        const newPrice = Math.max(0, currentPrice - decrement);
                        handlePriceChange(newPrice.toString());
                    }
                    break;

                case 'g':
                case 'G':
                    event.preventDefault();
                    setConditionDir('gt');
                    break;

                case 'l':
                case 'L':
                    event.preventDefault();
                    setConditionDir('lt');
                    break;

                case 'c':
                case 'C':
                    event.preventDefault();
                    clearHighlightedOrder();
                    break;

                case '[':
                    event.preventDefault();
                    toggleLeftSidebar();
                    break;

                case ']':
                    event.preventDefault();
                    toggleRightSidebar();
                    break;

                default:
                    break;
            }
        };

        // Handle wheel events for spread adjustment in sandwich mode
        const handleWheel = (event: WheelEvent) => {
            if ((event.ctrlKey || event.metaKey) && selectedOrderType === 'sandwich') {
                event.preventDefault();
                const currentSpread = parseFloat(sandwichSpread) || 0;
                const delta = event.deltaY > 0 ? -0.1 : 0.1;
                const newSpread = Math.max(0, currentSpread + delta);
                handleSandwichSpreadChange(newSpread.toString());
            }
        };

        // Add event listeners
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('wheel', handleWheel, { passive: false });

        // Cleanup
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('wheel', handleWheel);
        };
    }, [
        setIsProMode,
        selectedOrderType,
        setSelectedOrderType,
        targetPrice,
        handlePriceChange,
        conditionDir,
        setConditionDir,
        clearHighlightedOrder,
        handleCreateLimitOrder,
        handleCreateDcaOrder,
        handleCreateSandwichOrder,
        handleSwitchTokensEnhanced,
        sandwichSpread,
        handleSandwichSpreadChange,
        toggleLeftSidebar,
        toggleRightSidebar,
    ]);

    return (
        <div className="fixed inset-0 bg-background z-50 flex">
            {/* Left Sidebar - Order Type Selection */}
            <div
                data-sidebar="left"
                className={`
                    transition-all duration-300 ease-in-out border-r border-border/40 bg-card/50 backdrop-blur-sm
                    ${leftSidebarCollapsed ? 'w-12 sm:w-16' : 'w-64 sm:w-80'}
                    ${leftSidebarCollapsed ? 'overflow-hidden' : ''}
                `}
            >
                <OrderTypeSelector collapsed={leftSidebarCollapsed} />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <ProModeHeader />

                {/* Chart Area */}
                <ProModeChart />

                {/* Order Controls Section */}
                <OrderControls />
            </div>

            {/* Right Sidebar - Orders */}
            <div
                data-sidebar="right"
                className={`
                    transition-all duration-300 ease-in-out border-l border-border/40 bg-card/50 backdrop-blur-sm
                    ${rightSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-80 sm:w-96'}
                `}
            >
                <OrdersSidebar collapsed={rightSidebarCollapsed} />
            </div>

            {/* Token Selection Dialog */}
            <TokenSelectionDialog
                isOpen={tokenSelectionState.isOpen}
                onClose={closeTokenSelection}
                selectionType={tokenSelectionState.selectionType || 'from'}
                title={tokenSelectionState.title}
            />
        </div>
    );
}

export default function ProModeLayout() {
    return (
        <ProModeProvider>
            <ProModeLayoutContent />
        </ProModeProvider>
    );
} 