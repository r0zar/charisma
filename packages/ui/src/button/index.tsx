import React, { ButtonHTMLAttributes } from 'react';
import { cn } from '../utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
}

export function Button({
    className,
    variant = 'primary',
    size = 'md',
    children,
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            className={cn(
                // Base styles
                "inline-flex items-center justify-center rounded-md font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",

                // Size variations
                size === 'sm' && "px-3 py-1.5 text-xs",
                size === 'md' && "px-4 py-2 text-sm",
                size === 'lg' && "px-6 py-3 text-base",

                // Variant styles
                variant === 'primary' && "bg-primary text-white hover:bg-primary-700 focus-visible:ring-primary-800",
                variant === 'secondary' && "bg-secondary text-white hover:bg-secondary-700 focus-visible:ring-secondary-800",
                variant === 'outline' && "border border-border bg-transparent hover:bg-muted-50 text-foreground",
                variant === 'ghost' && "bg-transparent hover:bg-muted-50 text-foreground",

                // Disabled state
                disabled && "opacity-50 cursor-not-allowed pointer-events-none",

                // Custom classes passed through className prop
                className
            )}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    );
} 