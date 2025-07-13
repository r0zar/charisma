/**
 * Help system types for strategy editor
 */

export interface CodeExample {
  id: string;
  title: string;
  description: string;
  code: string;
  language: 'javascript' | 'typescript';
  copyable: boolean;
  category?: string;
}

export interface ExternalLink {
  title: string;
  url: string;
  description: string;
}

export interface HelpSection {
  id: string;
  title: string;
  content: string;
  examples: CodeExample[];
  links: ExternalLink[];
  searchTerms: string[];
}

export interface HelpTab {
  id: string;
  title: string;
  icon?: string;
  sections: HelpSection[];
}

export interface HelpContent {
  tabs: HelpTab[];
  quickStart: CodeExample[];
  troubleshooting: TroubleshootingItem[];
}

export interface TroubleshootingItem {
  id: string;
  problem: string;
  solution: string;
  code?: string;
  relatedLinks?: string[];
}

export interface RepositoryHelpInfo {
  gitUrl?: string;
  subPath?: string;
  availablePackages?: string[];
  buildCommands?: string[];
}

export interface HelpContextualInfo {
  currentRepository?: RepositoryHelpInfo;
  lastError?: string;
  cursorPosition?: {
    line: number;
    column: number;
  };
}