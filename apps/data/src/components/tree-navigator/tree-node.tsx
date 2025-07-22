import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TreeNodeComponentProps } from './types';
import { formatBytes, getNodeIcon, getNodeColor, getDisplayName } from './utils';

export function TreeNodeComponent({
  name,
  node,
  level,
  fullPath,
  onSelect,
  expandedPaths,
  setExpandedPaths,
  selectedPath
}: TreeNodeComponentProps) {
  const expanded = expandedPaths.has(fullPath);
  const isSelected = selectedPath === fullPath;
  const [loading, setLoading] = useState(false);
  
  const Icon = getNodeIcon(name, node.type);
  const iconColor = getNodeColor(name, node.type);
  
  const toggleExpanded = () => {
    const newExpandedPaths = new Set(expandedPaths);
    if (expanded) {
      newExpandedPaths.delete(fullPath);
    } else {
      newExpandedPaths.add(fullPath);
    }
    setExpandedPaths(newExpandedPaths);
  };

  const handleClick = async () => {
    if (node.type === 'directory') {
      toggleExpanded();
      
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/${fullPath}`);
        if (response.ok) {
          const data = await response.json();
          onSelect(fullPath, data);
        } else {
          onSelect(fullPath, null);
        }
      } catch (error) {
        console.error('Failed to load directory data:', error);
        onSelect(fullPath, null);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        let apiPath = fullPath.replace('.json', '');
        
        if (fullPath === 'v1') {
          apiPath = '';
        } else if (fullPath.endsWith('-blob.json')) {
          const section = fullPath.replace('-blob.json', '').split('/').pop();
          apiPath = section || '';
        } else if (fullPath.includes('price-series/')) {
          apiPath = fullPath;
        }
        
        const response = await fetch(`/api/v1/${apiPath}`);
        if (response.ok) {
          const data = await response.json();
          onSelect(fullPath, data);
        }
      } catch (error) {
        console.error('Failed to load file:', error);
      } finally {
        setLoading(false);
      }
    }
  };
  
  return (
    <div>
      <div
        className={`flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer ${
          loading ? 'opacity-50' : ''
        } ${
          isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''
        }`}
        style={{ paddingLeft: `${(level * 16) + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' && (
          expanded ? 
            <ChevronDown className="h-4 w-4 text-muted-foreground" /> :
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        
        <Icon className={`h-4 w-4 ${iconColor}`} />
        
        <span className="text-sm truncate flex-1">
          {getDisplayName(name, node.type)}
        </span>
        
        {node.type === 'file' && node.size && (
          <Badge variant="secondary" className="text-xs">
            {formatBytes(node.size)}
          </Badge>
        )}
      </div>
      
      {node.type === 'directory' && expanded && node.children && (
        <div>
          {Object.entries(node.children).map(([childName, childNode]) => (
            <TreeNodeComponent
              key={childName}
              name={childName}
              node={childNode}
              level={level + 1}
              fullPath={`${fullPath}/${childName}`}
              onSelect={onSelect}
              expandedPaths={expandedPaths}
              setExpandedPaths={setExpandedPaths}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}