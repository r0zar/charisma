import React, { CSSProperties, TextareaHTMLAttributes, useState } from 'react';

const baseTextareaStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    minHeight: '80px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    color: '#1f2937',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '0.375rem',
    transition: 'border 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
    resize: 'vertical'
};

const focusStyle: CSSProperties = {
    outline: 'none',
    border: '1px solid #3b82f6',
    boxShadow: '0 0 0 1px #3b82f6'
};

export function Textarea({ style, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <textarea
            style={{
                ...baseTextareaStyle,
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