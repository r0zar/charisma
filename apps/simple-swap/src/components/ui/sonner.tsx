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
          description: "!text-white/80 text-sm mt-1",
          actionButton: "button-primary shadow-none px-3 py-1.5 text-xs rounded-lg",
          cancelButton: "bg-muted text-muted-foreground hover:bg-muted/80 shadow-none px-3 py-1.5 text-xs rounded-lg",
          success: "!bg-green-500/15 !border-green-500/50 !text-green-700 dark:!text-green-400",
          error: "!bg-destructive/20 !border-destructive/30",
          warning: "!bg-warning/20 !border-warning/30",
          info: "!bg-info/20 !border-info/30",
          icon: "h-5 w-5 text-green-500",
          closeButton: "rounded-full p-1.5 backdrop-blur text-foreground/80 hover:text-foreground"
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast } 