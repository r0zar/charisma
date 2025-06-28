import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Slot } from "@radix-ui/react-slot"

const Form = React.forwardRef<
    HTMLFormElement,
    React.FormHTMLAttributes<HTMLFormElement>
>(({ className, ...props }, ref) => {
    return (
        <form
            ref={ref}
            className={cn("space-y-4", className)}
            {...props}
        />
    )
}) as any
Form.displayName = "Form"

const FormItem = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
    return (
        <div
            ref={ref}
            className={cn("space-y-2", className)}
            {...props}
        />
    )
}) as any
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<
    React.ElementRef<typeof Label>,
    React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => {
    return (
        <Label
            ref={ref}
            className={cn("block", className)}
            {...props}
        />
    )
});
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<
    React.ElementRef<typeof Slot>,
    React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
    return (
        <Slot
            ref={ref}
            {...props}
        />
    )
}) as any
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
    return (
        <p
            ref={ref}
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    )
}) as any
FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
    return (
        <p
            ref={ref}
            className={cn("text-sm font-medium text-destructive", className)}
            {...props}
        >
            {children}
        </p>
    )
}) as any
FormMessage.displayName = "FormMessage"

const FormField = (
    {
        control,
        name,
        render,
    }: {
        control: any;
        name: string;
        render: ({ field }: { field: any }) => React.ReactNode;
    }
) => {
    return render({ field: { name, onChange: () => { }, value: "" } }) as any;
}
FormField.displayName = "FormField"

export {
    Form,
    FormItem,
    FormLabel,
    FormControl,
    FormDescription,
    FormMessage,
    FormField,
}