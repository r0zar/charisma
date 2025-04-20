import React, { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils';

export interface TextareaProps
    extends TextareaHTMLAttributes<HTMLTextAreaElement> { }

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                className={cn(
                    "flex min-h-20 w-full rounded-md border border-border bg-background px-3 py-2",
                    "text-sm ring-offset-background resize-vertical",
                    "placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);

Textarea.displayName = "Textarea"; 