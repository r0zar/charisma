"use client";

import React from 'react';

interface AmountInputProps {
    value: string;
    onChange: (value: string) => void;
    maxAmount: number;
    onError: (error: string) => void;
    label: string;
    placeholder?: string;
    prefix?: string;
    suffix?: string;
    onSetMax?: () => void;
}

export default function AmountInput({
    value,
    onChange,
    maxAmount,
    onError,
    label,
    placeholder = "0.00",
    prefix = "$",
    suffix = "USD",
    onSetMax,
}: AmountInputProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm text-foreground/80 font-medium">{label}</label>

                {onSetMax && (
                    <button
                        className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded hover:bg-primary/20 transition-colors"
                        onClick={onSetMax}
                    >
                        MAX
                    </button>
                )}
            </div>

            <div className="relative">
                {prefix && (
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-muted-foreground sm:text-sm">{prefix}</span>
                    </div>
                )}

                <input
                    type="text" // Changed from number to text to remove arrows
                    value={value}
                    onChange={(e) => {
                        const newValue = e.target.value;
                        // Only allow digits, a single decimal point, and empty string
                        if (/^[0-9]*\.?[0-9]*$/.test(newValue) || newValue === "") {
                            onChange(newValue);

                            // Handle max amount validation
                            if (parseFloat(newValue) > maxAmount) {
                                onError(`Maximum amount is ${prefix}${maxAmount}`);
                                onChange(maxAmount.toString());
                            } else {
                                onError("");
                            }
                        }
                    }}
                    placeholder={placeholder}
                    className="bg-muted/20 border border-muted/40 rounded-xl py-2 px-3 w-full focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none"
                    style={{
                        paddingLeft: prefix ? "1.75rem" : "0.75rem",
                        paddingRight: suffix ? "3rem" : "0.75rem",
                    }}
                />

                {suffix && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-muted-foreground sm:text-sm">{suffix}</span>
                    </div>
                )}
            </div>
        </div>
    );
}