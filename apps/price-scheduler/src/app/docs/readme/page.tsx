'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MarkdownRenderer } from '@/components/markdown-renderer';

export default function ReadmePage() {
  return (
    <main className="flex min-h-screen flex-col p-8">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Price Service README</h1>
            <p className="text-muted-foreground">Complete user guide for the three-engine architecture</p>
          </div>
          <div className="flex gap-2">
            <Link href="/docs">
              <Button variant="outline">← Docs Home</Button>
            </Link>
            <Link href="/docs/architecture">
              <Button variant="outline">Architecture →</Button>
            </Link>
          </div>
        </div>

        {/* Render the actual README.md file */}
        <MarkdownRenderer filePath="README.md" />

        {/* Navigation */}
        <div className="flex justify-between items-center pt-6">
          <Link href="/docs">
            <Button variant="outline">
              ← Back to Docs
            </Button>
          </Link>
          <Link href="/docs/architecture">
            <Button>
              Architecture Guide →
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}