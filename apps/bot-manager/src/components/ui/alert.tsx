import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { XIcon, InfoIcon, AlertTriangleIcon, CheckCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        info:
          "border-blue-500/50 text-blue-900 bg-blue-50 dark:border-blue-500 dark:text-blue-200 dark:bg-blue-950/50 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400",
        warning:
          "border-yellow-500/50 text-yellow-900 bg-yellow-50 dark:border-yellow-500 dark:text-yellow-200 dark:bg-yellow-950/50 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400",
        success:
          "border-green-500/50 text-green-900 bg-green-50 dark:border-green-500 dark:text-green-200 dark:bg-green-950/50 [&>svg]:text-green-600 dark:[&>svg]:text-green-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants> & {
    dismissible?: boolean
    onDismiss?: () => void
    autoHide?: boolean
    autoHideDelay?: number
  }
>(({ className, variant, dismissible, onDismiss, autoHide, autoHideDelay = 5000, children, ...props }, ref) => {
  const [isVisible, setIsVisible] = React.useState(true)
  const [progress, setProgress] = React.useState(100)

  React.useEffect(() => {
    if (autoHide && autoHideDelay > 0) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev - (100 / (autoHideDelay / 100))
          if (newProgress <= 0) {
            setIsVisible(false)
            onDismiss?.()
            return 0
          }
          return newProgress
        })
      }, 100)

      return () => clearInterval(interval)
    }
  }, [autoHide, autoHideDelay, onDismiss])

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  const getIcon = () => {
    switch (variant) {
      case "info":
        return <InfoIcon className="size-4" />
      case "warning":
        return <AlertTriangleIcon className="size-4" />
      case "success":
        return <CheckCircleIcon className="size-4" />
      case "destructive":
        return <AlertTriangleIcon className="size-4" />
      default:
        return null
    }
  }

  if (!isVisible) return null

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {getIcon()}
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
          aria-label="Dismiss alert"
        >
          <XIcon className="size-4" />
        </button>
      )}
      <div className={cn(dismissible && "pr-8", 'flex items-center gap-2')}>
        {children}
      </div>
      {autoHide && (
        <div className="absolute bottom-0 left-0 h-1 bg-current/20 w-full rounded-b-lg overflow-hidden">
          <div
            className="h-full bg-current transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
})
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }