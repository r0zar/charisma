'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TreeNavigator } from '@/components/tree-navigator';
import { Separator } from '@/components/ui/separator';

export default function HomePage() {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);

  const handlePathSelect = (path: string, data: any) => {
    // Navigate to the path-based route
    router.push(`/${path}`);
  };

  return (
    <div className="flex h-screen">
      {/* Left Pane - Tree Navigator */}
      <div className="min-w-96 w-96 border-r border-border bg-card/50">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold">Blockchain Data</h2>
              <p className="text-sm text-muted-foreground">
                Browse addresses, contracts & prices
              </p>
            </div>
          </div>
        </div>
        <TreeNavigator
          onSelect={handlePathSelect}
          initialPath={null}
        />
      </div>

      <Separator orientation="vertical" />

      {/* Right Pane - Data Editor */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Select Data to Edit</h2>
          <p className="text-sm text-muted-foreground">
            Choose a path from the tree to view and edit data
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-center">
            Select a path from the tree navigator to view and edit data
          </p>
        </div>
      </div>
    </div>
  );
}