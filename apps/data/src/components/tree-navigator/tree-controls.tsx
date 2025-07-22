import { Button } from '@/components/ui/button';
import { TreeControlsProps } from './types';

export function TreeControls({ 
  onRefresh, 
  onExpandAll, 
  onCollapseAll, 
  expandedCount 
}: TreeControlsProps) {
  return (
    <div className="p-2 border-b border-border space-y-1">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onRefresh}
        className="w-full justify-start"
      >
        Refresh Tree
      </Button>
      <div className="flex gap-1">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onExpandAll}
          className="flex-1 text-xs"
        >
          Expand All
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onCollapseAll}
          className="flex-1 text-xs"
        >
          Collapse All
        </Button>
      </div>
      {expandedCount > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          {expandedCount} paths expanded
        </div>
      )}
    </div>
  );
}