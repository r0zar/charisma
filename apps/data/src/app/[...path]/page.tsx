'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { TreeNavigator } from '@/components/tree-navigator';
import { DataEditor } from '@/components/data-editor';
import { Separator } from '@/components/ui/separator';

export default function PathPage() {
  const router = useRouter();
  const params = useParams();
  const [selectedData, setSelectedData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Get the current path from URL parameters
  const currentPath = Array.isArray(params.path) ? params.path.join('/') : params.path || '';

  // Load data for the current path on mount and path changes
  useEffect(() => {
    if (currentPath) {
      loadPathData(currentPath);
    } else {
      setLoading(false);
    }
  }, [currentPath]);

  const loadPathData = async (path: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/${path}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedData(data);
      } else {
        setSelectedData(null);
      }
    } catch (error) {
      console.error('Failed to load path data:', error);
      setSelectedData(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePathSelect = (path: string, data: any) => {
    setSelectedData(data);
    // Navigate to the new path
    router.push(`/${path}`);
  };

  const handleSeedCharisma = async () => {
    try {
      const response = await fetch('/api/seed/charisma', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Successfully seeded Charisma data!\n\nRefresh the tree to see all the new addresses and contracts.');
        window.location.reload();
      } else {
        alert(`❌ Seeding failed: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
          initialPath={currentPath || null}
        />
      </div>

      <Separator orientation="vertical" />

      {/* Right Pane - Data Editor */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {currentPath ? `Editing: ${currentPath}` : 'Select Data to Edit'}
          </h2>
          {currentPath && (
            <p className="text-sm text-muted-foreground">
              /{currentPath}
            </p>
          )}
        </div>
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <DataEditor
              path={currentPath || null}
              data={selectedData}
              onSave={(path, data) => {
                console.log('Saving:', path, data);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}