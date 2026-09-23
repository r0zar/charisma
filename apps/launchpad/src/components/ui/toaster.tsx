"use client";

import { useToast } from "@/components/ui/use-toast";
import { Toast, ToastClose, ToastDescription, ToastTitle } from "@/components/ui/toast";

/** Renders toasts queued through useToast(). Without this mounted, those toasts never appear. */
export function Toaster() {
    const { toasts, dismiss } = useToast();
    const visible = toasts.filter((t) => t.open !== false);
    if (visible.length === 0) return null;
    return (
        <div className="fixed bottom-4 left-4 z-[100] flex w-full max-w-[420px] flex-col gap-2">
            {visible.map(({ id, title, description, variant }) => (
                <Toast key={id} variant={variant} role="status">
                    <div className="grid gap-1">
                        {title && <ToastTitle>{title}</ToastTitle>}
                        {description && <ToastDescription>{description}</ToastDescription>}
                    </div>
                    <ToastClose onClick={() => dismiss(id)} aria-label="Dismiss" />
                </Toast>
            ))}
        </div>
    );
}
