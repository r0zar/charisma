"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"

export interface DialogProps extends DialogPrimitive.DialogProps {
    children: React.ReactNode
}

const Dialog = ({ children, ...props }: DialogProps) => (
    <DialogPrimitive.Root {...props}>
        {children}
    </DialogPrimitive.Root>
)
Dialog.displayName = DialogPrimitive.Root.displayName

export interface DialogTriggerProps extends DialogPrimitive.DialogTriggerProps {
    className?: string
}

const DialogTrigger = ({ className, ...props }: DialogTriggerProps) => (
    <DialogPrimitive.Trigger
        className={cn("", className)}
        {...props}
    />
)
DialogTrigger.displayName = DialogPrimitive.Trigger.displayName

export interface DialogPortalProps extends DialogPrimitive.DialogPortalProps {
    children: React.ReactNode
}

const DialogPortal = ({
    children,
    ...props
}: DialogPortalProps) => (
    <DialogPrimitive.Portal {...props}>
        {children}
    </DialogPrimitive.Portal>
)
DialogPortal.displayName = DialogPrimitive.Portal.displayName

export interface DialogOverlayProps extends React.HTMLAttributes<HTMLDivElement> { }

const DialogOverlay = ({
    className,
    ...props
}: DialogOverlayProps) => (
    <DialogPrimitive.Overlay
        className={cn(
            "fixed inset-0 z-50 bg-black/80 backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 transition-all duration-200",
            className
        )}
        {...props}
    />
)
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

const DialogContent = ({
    className,
    children,
    ...props
}: DialogContentProps) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
            className={cn(
                "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl md:w-full",
                className
            )}
            {...props}
        >
            {children}
            <DialogPrimitive.Close className="absolute right-4 top-4 rounded-xl opacity-70 ring-offset-background transition-all duration-200 hover:opacity-100 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground p-1">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
        </DialogPrimitive.Content>
    </DialogPortal>
)
DialogContent.displayName = DialogPrimitive.Content.displayName

export interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> { }

const DialogHeader = ({
    className,
    ...props
}: DialogHeaderProps) => (
    <div
        className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
        {...props}
    />
)
DialogHeader.displayName = "DialogHeader"

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> { }

const DialogFooter = ({
    className,
    ...props
}: DialogFooterProps) => (
    <div
        className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
        {...props}
    />
)
DialogFooter.displayName = "DialogFooter"

export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> { }

const DialogTitle = ({
    className,
    ...props
}: DialogTitleProps) => (
    <DialogPrimitive.Title
        className={cn("text-lg font-semibold leading-none tracking-tight", className)}
        {...props}
    />
)
DialogTitle.displayName = DialogPrimitive.Title.displayName

export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> { }

const DialogDescription = ({
    className,
    ...props
}: DialogDescriptionProps) => (
    <DialogPrimitive.Description
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
)
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription
} 