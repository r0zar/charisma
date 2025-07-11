/**
 * Repository Analyzer Service
 * 
 * Analyzes git repositories to discover available packages and dependencies
 * for IntelliSense and package discovery.
 */

export interface RepositoryInfo {
  gitUrl: string;
  subPath?: string;
  branch?: string;
}

export interface PackageAnalysis {
  packageJson?: any;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  hasTypeScript: boolean;
  availablePackages: string[];
  error?: string;
}

export interface TypeDefinition {
  packageName: string;
  typesUrl?: string;
  version?: string;
  exports?: Record<string, any>;
}

export class RepositoryAnalyzer {
  
  /**
   * Quick analysis using GitHub API to fetch package.json
   */
  async quickAnalyze(repoInfo: RepositoryInfo): Promise<PackageAnalysis> {
    try {
      const packageJsonUrl = this.buildPackageJsonUrl(repoInfo);
      const response = await fetch(packageJsonUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch package.json: ${response.status}`);
      }
      
      const packageJson = await response.json();
      
      return this.analyzePackageJson(packageJson);
      
    } catch (error) {
      console.error('Quick analysis failed:', error);
      return {
        dependencies: [],
        devDependencies: [],
        scripts: {},
        hasTypeScript: false,
        availablePackages: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Build GitHub raw URL for package.json
   */
  private buildPackageJsonUrl(repoInfo: RepositoryInfo): string {
    const { gitUrl, subPath = '', branch = 'main' } = repoInfo;
    
    // Convert GitHub URL to raw content URL
    const githubMatch = gitUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!githubMatch) {
      throw new Error('Only GitHub repositories are supported for quick analysis');
    }
    
    const [, owner, repo] = githubMatch;
    const cleanRepo = repo.replace(/\.git$/, '');
    const path = subPath ? `${subPath}/package.json` : 'package.json';
    
    return `https://raw.githubusercontent.com/${owner}/${cleanRepo}/${branch}/${path}`;
  }
  
  /**
   * Analyze package.json content
   */
  private analyzePackageJson(packageJson: any): PackageAnalysis {
    const dependencies = Object.keys(packageJson.dependencies || {});
    const devDependencies = Object.keys(packageJson.devDependencies || {});
    const scripts = packageJson.scripts || {};
    
    // Check if TypeScript is used
    const hasTypeScript = 
      devDependencies.includes('typescript') ||
      dependencies.includes('typescript') ||
      !!scripts.build?.includes('tsc') ||
      !!scripts['check-types'];
    
    // Combine all available packages
    const availablePackages = [
      ...dependencies,
      ...devDependencies,
      // Add the package itself if it has a name
      ...(packageJson.name ? [packageJson.name] : [])
    ];
    
    return {
      packageJson,
      dependencies,
      devDependencies,
      scripts,
      hasTypeScript,
      availablePackages
    };
  }
  
  /**
   * Get type definitions for discovered packages
   */
  async getTypeDefinitions(packages: string[]): Promise<TypeDefinition[]> {
    const typeDefinitions: TypeDefinition[] = [];
    
    for (const packageName of packages) {
      try {
        const typeDef = await this.getPackageTypeInfo(packageName);
        if (typeDef) {
          typeDefinitions.push(typeDef);
        }
      } catch (error) {
        console.warn(`Failed to get types for ${packageName}:`, error);
      }
    }
    
    return typeDefinitions;
  }
  
  /**
   * Get type information for a specific package
   */
  private async getPackageTypeInfo(packageName: string): Promise<TypeDefinition | null> {
    try {
      // Try to fetch package info from npm registry
      const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`);
      
      if (!response.ok) {
        return null;
      }
      
      const packageInfo = await response.json();
      
      // Check if package has built-in types
      const hasTypes = packageInfo.types || packageInfo.typings;
      
      // Check for @types package
      const typesPackage = `@types/${packageName.replace('@', '').replace('/', '__')}`;
      
      return {
        packageName,
        version: packageInfo.version,
        typesUrl: hasTypes ? 
          `https://unpkg.com/${packageName}@${packageInfo.version}/${hasTypes}` :
          `https://unpkg.com/${typesPackage}/index.d.ts`,
        exports: packageInfo.exports
      };
      
    } catch (error) {
      console.warn(`Failed to analyze types for ${packageName}:`, error);
      return null;
    }
  }
  
  /**
   * Generate bot context type definition based on available packages
   */
  generateBotContextTypes(analysis: PackageAnalysis): string {
    const baseTypes = `
interface BotWalletCredentials {
  privateKey?: string;
}

interface Bot {
  id: string;
  name: string;
  walletCredentials: BotWalletCredentials;
}

declare const bot: Bot;
`;
    
    // Add package-specific type hints
    let packageTypes = '';
    
    if (analysis.availablePackages.includes('@stacks/transactions')) {
      packageTypes += `
// @stacks/transactions is available
// Import with: const { makeContractCall, broadcastTransaction } = require('@stacks/transactions');
`;
    }
    
    if (analysis.availablePackages.includes('@bots/basic')) {
      packageTypes += `
// @bots/basic is available  
// Import with: const { createContractCaller } = require('@bots/basic');
`;
    }
    
    return baseTypes + packageTypes;
  }
}

// Create default singleton instance
export const repositoryAnalyzer = new RepositoryAnalyzer();