"use client";

import React from 'react';
import { useSwapTokens } from '@/contexts/swap-tokens-context';
import { X } from 'lucide-react';

interface ValidationAlert {
  id: string;
  type: 'swap' | 'order';
  message: string;
  requirements: string[];
  timestamp: number;
}

export default function ValidationAlert() {
    const { 
        validationAlert, 
        clearValidationAlert,
        selectedFromToken,
        selectedToToken,
        displayAmount,
        targetPrice,
        mode
    } = useSwapTokens();

    if (!validationAlert) {
        return null;
    }

    const getValidationRequirements = () => {
        const requirements = [];
        
        if (!selectedFromToken) {
            requirements.push("Select a token to send");
        }
        
        if (!selectedToToken) {
            requirements.push("Select a token to receive");
        }
        
        if (!displayAmount || displayAmount === "0" || displayAmount.trim() === "") {
            requirements.push("Enter an amount to trade");
        }
        
        if (validationAlert.type === 'order' && (!targetPrice || targetPrice === '')) {
            requirements.push("Set a target price for your order");
        }
        
        return requirements;
    };

    const requirements = getValidationRequirements();

    return (
        <div className="mb-5 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-400 animate-[appear_0.3s_ease-out]">
            <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                    <div className="h-6 w-6 flex-shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mt-0.5">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-semibold mb-1">
                            {validationAlert.type === 'swap' ? 'Cannot Execute Swap' : 'Cannot Create Order'}
                        </h4>
                        <p className="text-xs leading-relaxed mb-3">
                            Please complete the following requirements:
                        </p>
                        <ul className="space-y-1">
                            {requirements.map((requirement, index) => (
                                <li key={index} className="flex items-start space-x-2 text-xs">
                                    <span className="inline-block w-1 h-1 rounded-full bg-current mt-2 flex-shrink-0"></span>
                                    <span>{requirement}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <button
                    onClick={clearValidationAlert}
                    className="ml-2 p-1 rounded-lg hover:bg-amber-500/20 transition-colors flex-shrink-0"
                    title="Dismiss alert"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}