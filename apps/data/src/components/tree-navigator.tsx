'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TreeNodeComponent } from './tree-navigator/tree-node';
import { TreeControls } from './tree-navigator/tree-controls';
import { TreeLoadingState } from './tree-navigator/tree-loading-state';
import { useTreeState } from './tree-navigator/use-tree-state';
import { TreeNavigatorProps } from './tree-navigator/types';

const STORAGE_KEY = 'tree-navigator-expanded-paths';


export function TreeNavigator({ onSelect, initialPath }: TreeNavigatorProps) {
  const {
    tree,
    loading,
    error,
    expandedPaths,
    selectedPath,
    setExpandedPaths,
    loadTree,
    expandAll,
    collapseAll
  } = useTreeState(initialPath, STORAGE_KEY);

  if (loading) {
    return <TreeLoadingState />;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={loadTree}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (Object.keys(tree).length === 0) {
    return (
      <div className="p-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            No data available
          </p>
          <Button variant="outline" size="sm" onClick={loadTree}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TreeControls
        onRefresh={loadTree}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        expandedCount={expandedPaths.size}
      />

      <ScrollArea className="flex-1">
        <div className="p-2">
          {Object.entries(tree).map(([name, node]) => (
            <TreeNodeComponent
              key={name}
              name={name}
              node={node}
              level={0}
              fullPath={name}
              onSelect={onSelect}
              expandedPaths={expandedPaths}
              setExpandedPaths={setExpandedPaths}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}