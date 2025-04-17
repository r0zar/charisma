import React, { ButtonHTMLAttributes, CSSProperties, useState } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

const baseStyles: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, color 0.2s ease-in-out'
};

interface VariantStyle {
    default: CSSProperties;
    hover: CSSProperties;
}

const variantStyles: Record<Required<ButtonProps>['variant'], VariantStyle> = {
    primary: {
        default: {
            backgroundColor: '#000000',
            color: '#ffffff',
        },
        hover: {
            backgroundColor: '#333333'
        }
    },
    secondary: {
        default: {
            backgroundColor: '#f3f4f6',
            color: '#1f2937',
        },
        hover: {
            backgroundColor: '#e5e7eb'
        }
    },
    outline: {
        default: {
            border: '1px solid #e5e7eb',
            backgroundColor: 'transparent',
            color: '#1f2937',
        },
        hover: {
            backgroundColor: '#f9fafb'
        }
    },
    ghost: {
        default: {
            backgroundColor: 'transparent',
            color: '#1f2937',
        },
        hover: {
            backgroundColor: '#f9fafb'
        }
    }
};

export function Button({ style, variant = 'primary', children, disabled, ...props }: ButtonProps) {
    const [isHovered, setIsHovered] = useState(false);
    const variantStyle = variantStyles[variant];
    const currentStyle = !disabled && isHovered ? { ...variantStyle.default, ...variantStyle.hover } : variantStyle.default;

    return (
        <button
            style={{
                ...baseStyles,
                ...currentStyle,
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
                ...style,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            {...props}
        >
            {children}
        </button>
    );
} 