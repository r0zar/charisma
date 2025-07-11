'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { CodeExample } from '@/lib/help/types';

interface CodeExampleProps {
  example: CodeExample;
  onCopy: (exampleId: string, code: string) => void;
  isCopied: boolean;
}

export function CodeExample({ example, onCopy, isCopied }: CodeExampleProps) {
  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">
              {example.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {example.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {example.language}
            </Badge>
            {example.copyable && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCopy(example.id, example.code)}
                className="h-8 w-8 p-0"
              >
                {isCopied ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative rounded-md overflow-hidden">
          <SyntaxHighlighter
            language={example.language === 'typescript' ? 'typescript' : 'javascript'}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '12px',
              fontSize: '13px',
              lineHeight: '1.4',
              backgroundColor: 'hsl(var(--muted))',
            }}
            showLineNumbers={false}
            wrapLines={true}
            wrapLongLines={true}
          >
            {example.code}
          </SyntaxHighlighter>
        </div>
        {example.category && (
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              {example.category}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}