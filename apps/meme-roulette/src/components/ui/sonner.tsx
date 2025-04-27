"use client"

import { Toaster as Sonner, ToasterProps, toast } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast: "group toast glass-card rounded-xl border border-border bg-card text-foreground flex overflow-hidden gap-2 p-4 items-start shadow-lg",
                    title: "text-foreground font-display font-semibold tracking-tight",
                    description: "text-muted-foreground text-sm mt-1",
                    actionButton: "button-primary shadow-none px-3 py-1.5 text-xs rounded-lg",
                    cancelButton: "bg-muted text-muted-foreground hover:bg-muted/80 shadow-none px-3 py-1.5 text-xs rounded-lg",
                    success: "!bg-success/20 !border-success/30",
                    error: "!bg-destructive/20 !border-destructive/30",
                    warning: "!bg-warning/20 !border-warning/30",
                    info: "!bg-info/20 !border-info/30",
                    icon: "h-5 w-5",
                    closeButton: "rounded-full p-1.5 backdrop-blur text-foreground/80 hover:text-foreground"
                },
                style: {
                    '--normal-bg': 'var(--card)',
                    '--normal-border': 'var(--border)',
                    '--normal-text': 'var(--foreground)',
                    '--success-bg': 'color-mix(in srgb, var(--success) 10%, var(--card))',
                    '--success-border': 'color-mix(in srgb, var(--success) 40%, transparent)',
                    '--success-text': 'var(--success)',
                    '--error-bg': 'color-mix(in srgb, var(--destructive) 10%, var(--card))',
                    '--error-border': 'color-mix(in srgb, var(--destructive) 40%, transparent)',
                    '--error-text': 'var(--destructive)',
                    '--warning-bg': 'color-mix(in srgb, var(--warning) 10%, var(--card))',
                    '--warning-border': 'color-mix(in srgb, var(--warning) 40%, transparent)',
                    '--warning-text': 'var(--warning)',
                    '--info-bg': 'color-mix(in srgb, var(--info) 10%, var(--card))',
                    '--info-border': 'color-mix(in srgb, var(--info) 40%, transparent)',
                    '--info-text': 'var(--info)',
                } as React.CSSProperties,
            }}
            {...props}
        />
    )
}

export { Toaster, toast } 