"use client"; // This component uses hooks, so it must be a Client Component

import React from 'react';
import { useCopyToClipboard } from 'react-use';
import { cn } from '@/lib/utils';

// SVG for Check icon
const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

// SVG for Copy icon
const CopyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
    </svg>
);

interface CopyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    textToCopy: string;
}

export function CopyButton({ textToCopy, className, ...props }: CopyButtonProps) {
    const [copied, setCopied] = React.useState(false);
    const [, copy] = useCopyToClipboard();

    const handleCopy = () => {
        copy(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500); // Reset icon after 1.5 seconds
    };

    return (
        <button
            onClick={handleCopy}
            className={cn(
                "absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded bg-muted p-1 text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-accent-foreground group-hover:opacity-100 disabled:opacity-50",
                className
            )}
            aria-label={copied ? "Copied!" : "Copy to clipboard"}
            title={copied ? "Copied!" : "Copy to clipboard"}
            disabled={copied}
            {...props}
        >
            {copied ? (
                <CheckIcon />
            ) : (
                <CopyIcon />
            )}
        </button>
    );
} 