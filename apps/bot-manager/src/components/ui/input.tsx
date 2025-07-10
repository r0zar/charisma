import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CheckIcon, AlertCircleIcon, Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex w-full min-w-0 rounded-md border bg-transparent text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      state: {
        default: "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        error: "border-destructive focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        success: "border-green-500 focus-visible:ring-green-500/20 dark:focus-visible:ring-green-500/40",
        loading: "pr-8"
      },
      size: {
        default: "h-9 px-3 py-1",
        sm: "h-8 px-2.5 py-1 text-xs",
        lg: "h-10 px-4 py-2"
      }
    },
    defaultVariants: {
      state: "default",
      size: "default"
    }
  }
)

function Input({
  className,
  type,
  state,
  size,
  helperText,
  maxLength,
  showCounter = false,
  value,
  defaultValue,
  ...props
}: React.ComponentProps<"input"> & 
  VariantProps<typeof inputVariants> & {
    state?: "default" | "error" | "success" | "loading"
    helperText?: string
    showCounter?: boolean
  }) {
  const inputId = React.useId()
  const [internalValue, setInternalValue] = React.useState(defaultValue || "")
  
  // Use controlled value if provided, otherwise use internal state
  const currentValue = value !== undefined ? value : internalValue
  const currentLength = String(currentValue || "").length
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (value === undefined) {
      setInternalValue(e.target.value)
    }
    props.onChange?.(e)
  }

  const isNearLimit = maxLength ? currentLength / maxLength > 0.8 : false
  const isOverLimit = maxLength ? currentLength > maxLength : false
  
  return (
    <div className="relative w-full">
      <input
        id={inputId}
        type={type}
        data-slot="input"
        className={cn(
          inputVariants({ state, size }), 
          showCounter && maxLength && "pr-16",
          className
        )}
        aria-invalid={state === "error"}
        aria-describedby={cn(
          helperText && `${inputId}-helper`,
          showCounter && maxLength && `${inputId}-counter`
        )}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        {...props}
      />
      
      {/* Status Icons */}
      {state === "loading" && (
        <Loader2Icon className="absolute right-2 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
      )}
      {state === "success" && !showCounter && (
        <CheckIcon className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-green-500" />
      )}
      {state === "error" && !showCounter && (
        <AlertCircleIcon className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-destructive" />
      )}
      
      {/* Character Counter */}
      {showCounter && maxLength && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {state === "success" && (
            <CheckIcon className="size-3 text-green-500" />
          )}
          {state === "error" && (
            <AlertCircleIcon className="size-3 text-destructive" />
          )}
          <span
            id={`${inputId}-counter`}
            className={cn(
              "text-xs tabular-nums",
              isOverLimit && "text-destructive",
              isNearLimit && !isOverLimit && "text-yellow-600",
              !isNearLimit && "text-muted-foreground"
            )}
          >
            {currentLength}/{maxLength}
          </span>
        </div>
      )}
      
      {/* Helper Text */}
      {helperText && (
        <p 
          id={`${inputId}-helper`}
          className={cn(
            "mt-1 text-xs",
            state === "error" && "text-destructive",
            state === "success" && "text-green-600",
            state === "default" && "text-muted-foreground"
          )}
        >
          {helperText}
        </p>
      )}
    </div>
  )
}

export { Input, inputVariants }