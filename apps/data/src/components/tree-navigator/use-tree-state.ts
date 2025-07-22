import { useState, useEffect } from 'react';
import { TreeNode } from './types';
import { buildTreeFromV1Data } from './tree-builder';

export function useTreeState(initialPath?: string | null, storageKey: string = 'tree-navigator-expanded-paths') {
  const [tree, setTree] = useState<{ [key: string]: TreeNode }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPathsState] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Load expanded paths from localStorage and handle initial path
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      let storedPaths = new Set<string>();
      
      if (stored) {
        const pathsArray = JSON.parse(stored);
        storedPaths = new Set(pathsArray);
      } else {
        // Default expanded paths for first visit - include balances and discovered
        storedPaths = new Set(['addresses', 'contracts', 'prices', 'balances', 'balance-series', 'discovered']);
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
      const fallbackPaths = new Set(['addresses', 'contracts', 'prices', 'balances', 'balance-series', 'discovered']);
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
  }, [initialPath, storageKey]);

  // Save expanded paths to localStorage whenever they change
  const setExpandedPaths = (paths: Set<string>) => {
    setExpandedPathsState(paths);
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(paths)));
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
      const response = await fetch('/api/v1');
      
      if (!response.ok) {
        throw new Error('Failed to load v1 data structure');
      }
      
      const rootData = await response.json();
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

  return {
    tree,
    loading,
    error,
    expandedPaths,
    selectedPath,
    setExpandedPaths,
    loadTree,
    expandAll,
    collapseAll
  };
}