"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> { }

const Label = ({ className, ...props }: LabelProps) => (
    <label
        className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            className
        )}
        {...props}
    />
)
Label.displayName = "Label"

export { Label } 