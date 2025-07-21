"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary"
  children?: React.ReactNode
}

export function CopyButton({ text, label, className, variant = "ghost", children }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (children) {
    return (
      <Button
        variant={variant}
        onClick={handleCopy}
        className={className}
      >
        {children}
      </Button>
    )
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleCopy}
      className={className || "h-8 w-8 p-0"}
    >
      <Copy className="h-4 w-4" />
      <span className="sr-only">Copy {label || 'text'}</span>
    </Button>
  )
}