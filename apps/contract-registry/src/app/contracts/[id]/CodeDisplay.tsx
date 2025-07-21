"use client"

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { CopyButton } from './CopyButton'

interface CodeDisplayProps {
  code: string
  language: string
  showLineNumbers?: boolean
  maxHeight?: string
  fontSize?: string
}

export function CodeDisplay({ 
  code, 
  language, 
  showLineNumbers = false, 
  maxHeight,
  fontSize = "0.875rem"
}: CodeDisplayProps) {
  return (
    <div className="relative">
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: '0.375rem',
          fontSize,
          maxHeight,
        }}
        showLineNumbers={showLineNumbers}
      >
        {code}
      </SyntaxHighlighter>
      <div className="absolute top-2 right-2">
        <CopyButton text={code} label="code" />
      </div>
    </div>
  )
}