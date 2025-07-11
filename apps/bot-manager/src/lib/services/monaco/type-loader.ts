/**
 * Monaco Type Loader Service
 * 
 * Loads TypeScript definitions into Monaco Editor for IntelliSense support.
 * Handles package discovery and dynamic type loading.
 */

import type { PackageAnalysis, TypeDefinition } from '../repository';

export interface MonacoTypeConfig {
  packages: string[];
  botContextTypes: string;
  moduleTypes: Record<string, string>;
}

export class MonacoTypeLoader {
  private loadedTypes = new Set<string>();
  
  /**
   * Load types for packages discovered in repository analysis
   */
  async loadTypesForPackages(analysis: PackageAnalysis): Promise<MonacoTypeConfig> {
    const config: MonacoTypeConfig = {
      packages: analysis.availablePackages,
      botContextTypes: this.generateBotContextTypes(analysis),
      moduleTypes: {}
    };
    
    // Load type definitions for each package
    for (const packageName of analysis.availablePackages) {
      try {
        const typeContent = await this.loadPackageTypes(packageName);
        if (typeContent) {
          config.moduleTypes[packageName] = typeContent;
        }
      } catch (error) {
        console.warn(`Failed to load types for ${packageName}:`, error);
      }
    }
    
    return config;
  }
  
  /**
   * Load TypeScript definitions for a specific package
   */
  private async loadPackageTypes(packageName: string): Promise<string | null> {
    if (this.loadedTypes.has(packageName)) {
      return null; // Already loaded
    }
    
    try {
      // Try built-in types first
      const builtInTypes = await this.tryBuiltInTypes(packageName);
      if (builtInTypes) {
        this.loadedTypes.add(packageName);
        return builtInTypes;
      }
      
      // Try @types package
      const typesPackage = this.getTypesPackageName(packageName);
      const typesContent = await this.fetchTypesFromCDN(typesPackage);
      if (typesContent) {
        this.loadedTypes.add(packageName);
        return typesContent;
      }
      
      return null;
      
    } catch (error) {
      console.warn(`Error loading types for ${packageName}:`, error);
      return null;
    }
  }
  
  /**
   * Try to load built-in types from the package itself
   */
  private async tryBuiltInTypes(packageName: string): Promise<string | null> {
    try {
      // Common type file locations
      const typePaths = [
        `https://unpkg.com/${packageName}/types/index.d.ts`,
        `https://unpkg.com/${packageName}/lib/index.d.ts`,
        `https://unpkg.com/${packageName}/dist/index.d.ts`,
        `https://unpkg.com/${packageName}/index.d.ts`
      ];
      
      for (const typePath of typePaths) {
        try {
          const response = await fetch(typePath);
          if (response.ok) {
            return await response.text();
          }
        } catch {
          // Try next path
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * Fetch types from @types packages
   */
  private async fetchTypesFromCDN(typesPackageName: string): Promise<string | null> {
    try {
      const response = await fetch(`https://unpkg.com/${typesPackageName}/index.d.ts`);
      if (response.ok) {
        return await response.text();
      }
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * Convert package name to @types package name
   */
  private getTypesPackageName(packageName: string): string {
    // Handle scoped packages like @stacks/transactions -> @types/stacks__transactions
    if (packageName.startsWith('@')) {
      return `@types/${packageName.slice(1).replace('/', '__')}`;
    }
    return `@types/${packageName}`;
  }
  
  /**
   * Generate bot context type definitions
   */
  private generateBotContextTypes(analysis: PackageAnalysis): string {
    let types = `
// Bot Context Types
interface BotWalletCredentials {
  privateKey?: string;
}

interface Bot {
  id: string;
  name: string;
  walletCredentials: BotWalletCredentials;
}

declare const bot: Bot;

// Available Packages (use with require() or import)
`;
    
    // Add comments for available packages
    for (const packageName of analysis.availablePackages) {
      types += `// ${packageName} - Available for import\n`;
    }
    
    // Add specific examples for common packages
    if (analysis.availablePackages.includes('@stacks/transactions')) {
      types += `
// Example: @stacks/transactions usage
// const { makeContractCall, broadcastTransaction } = require('@stacks/transactions');
`;
    }
    
    if (analysis.availablePackages.includes('@bots/basic')) {
      types += `
// Example: @bots/basic usage  
// const { createContractCaller } = require('@bots/basic');
// const caller = createContractCaller({ privateKey: bot.walletCredentials.privateKey });
`;
    }
    
    return types;
  }
  
  /**
   * Apply types to Monaco Editor instance
   */
  applyTypesToMonaco(monaco: any, config: MonacoTypeConfig): void {
    try {
      // Add bot context types
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        config.botContextTypes,
        'file:///bot-context.d.ts'
      );
      
      // Add package types
      for (const [packageName, typeContent] of Object.entries(config.moduleTypes)) {
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          typeContent,
          `file:///node_modules/${packageName}/index.d.ts`
        );
      }
      
      // Configure compiler options for Node.js
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2022,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        strict: false, // Less strict for strategy code
        noEmit: true
      });
      
    } catch (error) {
      console.error('Failed to apply types to Monaco:', error);
    }
  }
  
  /**
   * Clear all loaded types (useful for repository changes)
   */
  clearLoadedTypes(): void {
    this.loadedTypes.clear();
  }
}

// Create default singleton instance
export const monacoTypeLoader = new MonacoTypeLoader();