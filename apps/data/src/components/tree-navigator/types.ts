export interface TreeNode {
  type: 'file' | 'directory';
  size?: number;
  lastModified?: Date;
  path?: string;
  children?: { [key: string]: TreeNode };
}

export interface TreeNavigatorProps {
  onSelect: (path: string, data: any) => void;
  initialPath?: string | null;
}

export interface TreeNodeComponentProps {
  name: string;
  node: TreeNode;
  level: number;
  fullPath: string;
  onSelect: (path: string, data: any) => void;
  expandedPaths: Set<string>;
  setExpandedPaths: (paths: Set<string>) => void;
  selectedPath: string | null;
}

export interface TreeControlsProps {
  onRefresh: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  expandedCount: number;
}