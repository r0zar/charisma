import React from 'react';
import { cn } from '@/lib/utils';

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
    children: React.ReactNode;
}

export function CodeBlock({ children, className, ...props }: CodeBlockProps) {
    return (
        <pre
            className={cn(
                'bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono text-muted-foreground',
                className
            )}
            {...props}
        >
            <code>{children}</code>
        </pre>
    );
} 