'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, File, Folder, Wallet, Code, TrendingUp, LineChart, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface TreeNode {
  type: 'file' | 'directory';
  size?: number;
  lastModified?: Date;
  path?: string;
  children?: { [key: string]: TreeNode };
}

interface TreeNavigatorProps {
  onSelect: (path: string, data: any) => void;
  initialPath?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getNodeIcon(name: string, type: 'file' | 'directory') {
  if (type === 'directory') {
    if (name === 'addresses') return Wallet;
    if (name === 'contracts') return Code;
    if (name === 'prices') return TrendingUp;
    if (name === 'price-series') return LineChart;
    if (name === 'metadata') return Info;
    return Folder;
  }
  return File;
}

function getNodeColor(name: string, type: 'file' | 'directory') {
  if (type === 'directory') {
    if (name === 'addresses') return 'text-blue-500';
    if (name === 'contracts') return 'text-purple-500';
    if (name === 'prices') return 'text-green-500';
    if (name === 'price-series') return 'text-orange-500';
    if (name === 'metadata') return 'text-gray-500';
    return 'text-muted-foreground';
  }
  return 'text-muted-foreground';
}

function TreeNodeComponent({
  name,
  node,
  level,
  fullPath,
  onSelect,
  expandedPaths,
  setExpandedPaths,
  selectedPath
}: {
  name: string;
  node: TreeNode;
  level: number;
  fullPath: string;
  onSelect: (path: string, data: any) => void;
  expandedPaths: Set<string>;
  setExpandedPaths: (paths: Set<string>) => void;
  selectedPath: string | null;
}) {
  // Check if this path should be expanded from localStorage state
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
      // Toggle expansion for directories
      toggleExpanded();
      
      // Try to load the actual JSON data at this directory level
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/${fullPath}`);
        if (response.ok) {
          const data = await response.json();
          onSelect(fullPath, data);
        } else {
          // If no data at this level, just show the path was selected
          onSelect(fullPath, null);
        }
      } catch (error) {
        console.error('Failed to load directory data:', error);
        onSelect(fullPath, null);
      } finally {
        setLoading(false);
      }
    } else {
      // Load file data
      setLoading(true);
      try {
        let apiPath = fullPath.replace('.json', '');
        
        // Special handling for various files
        if (fullPath === 'v1') {
          apiPath = '';  // This will fetch /api/v1/ (the root)
        } else if (fullPath.endsWith('-blob.json')) {
          // For blob files, load the parent section data
          const section = fullPath.replace('-blob.json', '').split('/').pop();
          apiPath = section || '';
        } else if (fullPath.includes('price-series/')) {
          // For price-series files, the path already contains the correct contract ID
          // Just use the stored path directly
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
  
  // Preview for Stacks addresses
  const getAddressPreview = (name: string) => {
    if (name.match(/^S[PTM]/)) {
      return name.slice(0, 8) + '...' + name.slice(-4);
    }
    return name;
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
          {node.type === 'directory' && name.match(/^S[PTM]/) 
            ? getAddressPreview(name)
            : name === 'price-series' 
              ? 'Price Series'
              : name.replace('.json', '')
          }
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

const STORAGE_KEY = 'tree-navigator-expanded-paths';

async function buildTreeFromV1Data(rootData: any): Promise<{ [key: string]: TreeNode }> {
  const tree: { [key: string]: TreeNode } = {};
  
  // Add the v1 metadata file directly at the top level
  tree['v1'] = {
    type: 'file',
    size: JSON.stringify(rootData).length,
    lastModified: new Date(rootData.lastUpdated || Date.now()),
    path: ''
  };
  
  // Helper function to get simple token name from contract ID
  const getSimpleTokenName = (contractId: string): string => {
    const parts = contractId.split('.');
    if (parts.length === 2) {
      const tokenName = parts[1];
      if (tokenName.includes('-token')) {
        return tokenName.replace('-token', '').toUpperCase();
      } else if (tokenName.includes('coin')) {
        return tokenName.replace('coin', '').toUpperCase();
      } else if (tokenName === 'arkadiko-token') {
        return 'DIKO';
      } else if (tokenName === 'alex-token') {
        return 'ALEX';
      } else if (tokenName === 'charisma-token') {
        return 'CHA';
      } else if (tokenName === 'welshcorgicoin-token') {
        return 'WELSH';
      } else if (tokenName === 'sbtc-token') {
        return 'SBTC';
      }
      return tokenName.toUpperCase().slice(0, 10);
    }
    return contractId.slice(0, 10);
  };
  
  // Build addresses folder
  const addressesChildren: { [key: string]: TreeNode } = {};
  
  // Add individual addresses if any exist
  if (rootData.addresses && typeof rootData.addresses === 'object') {
    Object.keys(rootData.addresses).forEach(address => {
      addressesChildren[`${address}.json`] = {
        type: 'file',
        size: JSON.stringify(rootData.addresses[address]).length,
        lastModified: new Date(rootData.lastUpdated),
        path: `addresses/${address}`
      };
    });
  }
  
  tree.addresses = {
    type: 'directory',
    children: addressesChildren
  };
  
  // Build contracts folder
  const contractsChildren: { [key: string]: TreeNode } = {};
  
  // Add individual contracts if any exist
  if (rootData.contracts && typeof rootData.contracts === 'object') {
    Object.keys(rootData.contracts).forEach(contractId => {
      contractsChildren[`${contractId}.json`] = {
        type: 'file',
        size: JSON.stringify(rootData.contracts[contractId]).length,
        lastModified: new Date(rootData.lastUpdated),
        path: `contracts/${contractId}`
      };
    });
  }
  
  tree.contracts = {
    type: 'directory',
    children: contractsChildren
  };
  
  // Build prices folder
  const pricesChildren: { [key: string]: TreeNode } = {};
  
  // Add individual token price files
  if (rootData.prices && typeof rootData.prices === 'object') {
    Object.entries(rootData.prices).forEach(([key, value]) => {
      // Skip metadata fields
      if (key === 'lastUpdated' || key === 'source' || key === 'tokenCount') {
        return;
      }
      
      if (typeof key === 'string' && key.includes('.') && value && typeof value === 'object') {
        const simpleName = getSimpleTokenName(key);
        pricesChildren[`${simpleName}.json`] = {
          type: 'file',
          size: JSON.stringify(value).length,
          lastModified: new Date(rootData.prices.lastUpdated || rootData.lastUpdated),
          path: `prices/${key}`
        };
      }
    });
  }
  
  tree.prices = {
    type: 'directory',
    children: pricesChildren
  };
  
  // Build price-series folder
  const priceSeriesChildren: { [key: string]: TreeNode } = {};
  
  // Add individual price series files
  if (rootData['price-series'] && typeof rootData['price-series'] === 'object') {
    Object.entries(rootData['price-series']).forEach(([key, value]) => {
      // Skip metadata fields
      if (key === 'lastUpdated' || key === 'source' || key === 'seriesCount') {
        return;
      }
      
      if (typeof key === 'string' && key.includes('.') && value && typeof value === 'object') {
        const simpleName = getSimpleTokenName(key);
        priceSeriesChildren[`${simpleName}-series.json`] = {
          type: 'file',
          size: JSON.stringify(value).length,
          lastModified: new Date(rootData['price-series'].lastUpdated || rootData.lastUpdated),
          path: `price-series/${key}`
        };
      }
    });
  }
  
  tree['price-series'] = {
    type: 'directory',
    children: priceSeriesChildren
  };

  // Add metadata as a direct file item
  tree.metadata = {
    type: 'file',
    size: JSON.stringify(rootData.metadata || {}).length,
    lastModified: new Date(rootData.lastUpdated),
    path: 'metadata'
  };
  
  return tree;
}

export function TreeNavigator({ onSelect, initialPath }: TreeNavigatorProps) {
  const [tree, setTree] = useState<{ [key: string]: TreeNode }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPathsState] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Load expanded paths from localStorage and handle initial path
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      let storedPaths = new Set<string>();
      
      if (stored) {
        const pathsArray = JSON.parse(stored);
        storedPaths = new Set(pathsArray);
      } else {
        // Default expanded paths for first visit
        storedPaths = new Set(['addresses', 'contracts', 'prices']);
      }
      
      // If we have an initial path from URL, expand its parent paths
      if (initialPath) {
        setSelectedPath(initialPath);
        const pathSegments = initialPath.split('/');
        let currentPath = '';
        
        // Expand all parent directories for the initial path
        for (let i = 0; i < pathSegments.length; i++) {
          currentPath = i === 0 ? pathSegments[i] : `${currentPath}/${pathSegments[i]}`;
          storedPaths.add(currentPath);
        }
      }
      
      setExpandedPathsState(storedPaths);
    } catch (error) {
      console.error('Failed to load tree state from localStorage:', error);
      // Fallback to default expansion
      const fallbackPaths = new Set(['addresses', 'contracts', 'prices']);
      if (initialPath) {
        const pathSegments = initialPath.split('/');
        let currentPath = '';
        for (let i = 0; i < pathSegments.length; i++) {
          currentPath = i === 0 ? pathSegments[i] : `${currentPath}/${pathSegments[i]}`;
          fallbackPaths.add(currentPath);
        }
      }
      setExpandedPathsState(fallbackPaths);
    }
  }, [initialPath]);

  // Save expanded paths to localStorage whenever they change
  const setExpandedPaths = (paths: Set<string>) => {
    setExpandedPathsState(paths);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(paths)));
    } catch (error) {
      console.error('Failed to save tree state to localStorage:', error);
    }
  };
  
  useEffect(() => {
    loadTree();
  }, []);
  
  const loadTree = async () => {
    try {
      setLoading(true);
      // Use the unified blob storage to build the navigation tree
      const response = await fetch('/api/v1');
      
      if (!response.ok) {
        throw new Error('Failed to load v1 data structure');
      }
      
      const rootData = await response.json();
      
      // Build a tree structure from the v1 data
      const treeData = await buildTreeFromV1Data(rootData);
      setTree(treeData);
      setError(null);
    } catch (err) {
      console.error('Tree loading error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRefresh = () => {
    loadTree();
  };

  const collapseAll = () => {
    setExpandedPaths(new Set());
  };

  const expandAll = () => {
    const allPaths = new Set<string>();
    
    const collectPaths = (obj: { [key: string]: TreeNode }, currentPath: string = '') => {
      Object.entries(obj).forEach(([name, node]) => {
        const fullPath = currentPath ? `${currentPath}/${name}` : name;
        if (node.type === 'directory') {
          allPaths.add(fullPath);
          if (node.children) {
            collectPaths(node.children, fullPath);
          }
        }
      });
    };
    
    collectPaths(tree);
    setExpandedPaths(allPaths);
  };

  // Debug function to export/import tree state
  const exportTreeState = () => {
    const state = Array.from(expandedPaths);
    console.log('Current tree state:', state);
    return state;
  };

  const importTreeState = (state: string[]) => {
    setExpandedPaths(new Set(state));
  };
  
  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-8 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
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
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-border space-y-1">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleRefresh}
          className="w-full justify-start"
        >
          Refresh Tree
        </Button>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={expandAll}
            className="flex-1 text-xs"
          >
            Expand All
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={collapseAll}
            className="flex-1 text-xs"
          >
            Collapse All
          </Button>
        </div>
        {expandedPaths.size > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            {expandedPaths.size} paths expanded
          </div>
        )}
      </div>
      
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