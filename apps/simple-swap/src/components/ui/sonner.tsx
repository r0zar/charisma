"use client"

import { Toaster as Sonner, ToasterProps, toast } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast rounded-xl border border-line bg-surface-raised text-ink flex overflow-hidden gap-2 p-4 items-start shadow-[var(--shadow-overlay)]",
          title: "text-ink font-semibold tracking-tight",
          description: "!text-foreground/80 text-sm mt-1",
          actionButton: "button-primary shadow-none px-3 py-1.5 text-xs rounded-lg",
          cancelButton: "bg-surface-hover text-ink-muted hover:bg-surface-selected shadow-none px-3 py-1.5 text-xs rounded-lg",
          success: "!bg-success-soft !border-success/40 !text-success",
          error: "!bg-danger-soft !border-danger/40 !text-danger",
          warning: "!bg-warning-soft !border-warning/40 !text-warning",
          info: "!bg-surface-raised !border-line !text-ink",
          icon: "h-5 w-5",
          closeButton: "rounded-full p-1.5 backdrop-blur text-ink-body hover:text-ink"
        },
        // brand tokens; every one is defined in @repo/brand/tokens.css for both realms
        style: {
          '--normal-bg': 'var(--surface-raised)',
          '--normal-border': 'var(--line)',
          '--normal-text': 'var(--ink)',
          '--success-bg': 'var(--success-soft)',
          '--success-border': 'var(--success)',
          '--success-text': 'var(--success)',
          '--error-bg': 'var(--danger-soft)',
          '--error-border': 'var(--danger)',
          '--error-text': 'var(--danger)',
          '--warning-bg': 'var(--warning-soft)',
          '--warning-border': 'var(--warning)',
          '--warning-text': 'var(--warning)',
          '--info-bg': 'var(--surface-raised)',
          '--info-border': 'var(--line)',
          '--info-text': 'var(--ink)',
        } as React.CSSProperties,
      }}
      {...props}
    />
  )
}

export { Toaster, toast } 