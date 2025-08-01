import { ExternalLink } from 'lucide-react'
import { Button } from './button'
import { getTransactionUrl, formatTransactionId, isValidTransactionId } from '@/lib/stacks-explorer'
import { cn } from '@/lib/utils'

interface TransactionLinkProps {
  txId: string | null | undefined
  variant?: 'button' | 'link' | 'inline'
  size?: 'sm' | 'default' | 'lg'
  showIcon?: boolean
  className?: string
  children?: React.ReactNode
}

export function TransactionLink({ 
  txId, 
  variant = 'link',
  size = 'default',
  showIcon = true,
  className,
  children
}: TransactionLinkProps) {
  // Don't render anything if no valid transaction ID
  if (!txId || !isValidTransactionId(txId)) {
    return null
  }

  const transactionUrl = getTransactionUrl(txId)
  const displayText = children || formatTransactionId(txId)

  const handleClick = () => {
    window.open(transactionUrl, '_blank', 'noopener,noreferrer')
  }

  if (variant === 'button') {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={handleClick}
        className={cn("flex items-center gap-2", className)}
      >
        {displayText}
        {showIcon && <ExternalLink className="h-4 w-4" />}
      </Button>
    )
  }

  if (variant === 'inline') {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1 text-primary hover:text-primary/80 underline decoration-dotted underline-offset-4 text-sm font-mono",
          className
        )}
      >
        {displayText}
        {showIcon && <ExternalLink className="h-3 w-3" />}
      </button>
    )
  }

  // Default 'link' variant
  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2 text-primary hover:text-primary/80 underline decoration-dotted underline-offset-4 transition-colors",
        size === 'sm' && "text-sm",
        size === 'lg' && "text-lg",
        className
      )}
    >
      <span className="font-mono">{displayText}</span>
      {showIcon && <ExternalLink className="h-4 w-4 flex-shrink-0" />}
    </button>
  )
}