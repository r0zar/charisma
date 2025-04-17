import React, { CSSProperties, InputHTMLAttributes, useState } from 'react';

const baseInputStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    color: '#1f2937',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.375rem',
    transition: 'border 0.15s ease-in-out, box-shadow 0.15s ease-in-out'
};

const focusStyle: CSSProperties = {
    outline: 'none',
    border: '1px solid #3b82f6',
    boxShadow: '0 0 0 1px #3b82f6'
};

export function Input({ style, ...props }: InputHTMLAttributes<HTMLInputElement>) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <input
            style={{
                ...baseInputStyle,
                ...(isFocused ? focusStyle : {}),
                ...style
            }}
            onFocus={(e) => {
                setIsFocused(true);
                props.onFocus?.(e);
            }}
            onBlur={(e) => {
                setIsFocused(false);
                props.onBlur?.(e);
            }}
            {...props}
        />
    );
} 