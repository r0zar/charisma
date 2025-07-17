'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MarkdownRenderer } from '@/components/markdown-renderer';

export default function ArchitecturePage() {
  return (
    <main className="flex min-h-screen flex-col p-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Price Service Architecture</h1>
            <p className="text-muted-foreground">Technical architecture and implementation details</p>
          </div>
          <div className="flex gap-2">
            <Link href="/docs/readme">
              <Button variant="outline">← README</Button>
            </Link>
            <Link href="/docs">
              <Button variant="outline">Docs Home</Button>
            </Link>
          </div>
        </div>

        {/* Render the actual ARCHITECTURE.md file */}
        <MarkdownRenderer filePath="ARCHITECTURE.md" />

        {/* Navigation */}
        <div className="flex justify-between items-center pt-6">
          <Link href="/docs/readme">
            <Button variant="outline">
              ← README Guide
            </Button>
          </Link>
          <Link href="/docs">
            <Button>
              Back to Docs Home
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}