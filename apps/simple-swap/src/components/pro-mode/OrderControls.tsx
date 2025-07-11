"use client";

import React from 'react';
import { useProModeContext } from '../../contexts/pro-mode-context';
import OrderPreview from './OrderPreview';
import OrderForm from './OrderForm';

export default function OrderControls() {
    const { selectedOrderType } = useProModeContext();

    return (
        <div
            data-order-controls
            className="border-t border-border/40 bg-card/50 backdrop-blur-sm p-2 sm:p-4 flex-shrink-0 max-h-80 sm:max-h-96 overflow-y-auto"
        >
            {/* Just Order Form and Preview - No information panel */}
            <div
                data-order-form-container
                className="flex flex-col xl:flex-row gap-3 xl:gap-6 min-h-0"
            >
                {/* Order Form Controls */}
                <div className="flex-1 min-w-0">
                    <OrderForm />
                </div>

                {/* Order Preview - responsive container */}
                <div className="w-full xl:w-auto xl:flex-shrink-0">
                    <OrderPreview />
                </div>
            </div>
        </div>
    );
} 