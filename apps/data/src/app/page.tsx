'use client';

import { useState } from 'react';
import { TreeNavigator } from '@/components/tree-navigator';
import { DataEditor } from '@/components/data-editor';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Database, Loader2 } from 'lucide-react';

export default function HomePage() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<any>(null);
  const [seeding, setSeeding] = useState(false);

  const handleSeedCharisma = async () => {
    setSeeding(true);
    try {
      const response = await fetch('/api/seed/charisma', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('✅ Successfully seeded Charisma data!\n\nRefresh the tree to see all the new addresses and contracts.');
        // Optionally reload the page or refresh tree
        window.location.reload();
      } else {
        alert(`❌ Seeding failed: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left Pane - Tree Navigator */}
      <div className="w-80 border-r border-border bg-card/50">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold">Blockchain Data</h2>
              <p className="text-sm text-muted-foreground">
                Browse addresses, contracts & prices
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedCharisma}
            disabled={seeding}
            className="w-full mt-2"
          >
            {seeding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Seeding...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Seed Charisma Data
              </>
            )}
          </Button>
        </div>
        <TreeNavigator
          onSelect={(path, data) => {
            setSelectedPath(path);
            setSelectedData(data);
          }}
        />
      </div>
      
      <Separator orientation="vertical" />
      
      {/* Right Pane - Data Editor */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {selectedPath ? `Editing: ${selectedPath}` : 'Select Data to Edit'}
          </h2>
          {selectedPath && (
            <p className="text-sm text-muted-foreground">
              {selectedPath}
            </p>
          )}
        </div>
        <div className="flex-1">
          <DataEditor
            path={selectedPath}
            data={selectedData}
            onSave={(path, data) => {
              // Handle save logic
              console.log('Saving:', path, data);
            }}
          />
        </div>
      </div>
    </div>
  );
}