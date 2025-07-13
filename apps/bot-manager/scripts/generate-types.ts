#!/usr/bin/env tsx

/**
 * Build-time script to generate TypeScript type definitions for Monaco Editor
 * 
 * This script reads actual .d.ts files from node_modules and generates
 * a TypeScript file with the type definitions as strings that can be
 * imported in client-side components.
 */

import fs from 'fs';
import path from 'path';

interface ImportStatement {
  fullMatch: string;
  namedImports?: string[];
  namespaceImport?: string;
  defaultImport?: string;
  modulePath: string;
}

interface ProcessedImports {
  content: string;
  moduleDeclarations: string[];
}

interface TypeDefinitions {
  [moduleName: string]: string;
}

console.log('🔧 Generating Monaco TypeScript definitions...');

/**
 * Safely read a .d.ts file
 */
function readTypeDefinition(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      console.log(`✅ Read ${filePath}`);
      return content;
    } else {
      console.warn(`⚠️  File not found: ${filePath}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Find the actual paths to @stacks/transactions type definitions
 */
function findStacksTransactionsTypes(): string | null {
  const possiblePaths = [
    // Monorepo pnpm structure
    path.join(process.cwd(), '../../node_modules/.pnpm/@stacks+transactions@*/node_modules/@stacks/transactions/dist/index.d.ts'),
    // Local node_modules
    path.join(process.cwd(), 'node_modules/@stacks/transactions/dist/index.d.ts'),
    // Parent node_modules
    path.join(process.cwd(), '../node_modules/@stacks/transactions/dist/index.d.ts'),
    path.join(process.cwd(), '../../node_modules/@stacks/transactions/dist/index.d.ts'),
  ];

  for (const possiblePath of possiblePaths) {
    // Handle glob pattern for pnpm
    if (possiblePath.includes('*')) {
      const basePath = possiblePath.split('*')[0];
      const suffix = possiblePath.split('*')[1];
      
      try {
        const baseDir = path.dirname(basePath);
        if (fs.existsSync(baseDir)) {
          const entries = fs.readdirSync(baseDir);
          for (const entry of entries) {
            if (entry.startsWith('@stacks+transactions@')) {
              const fullPath = path.join(baseDir, entry, suffix);
              if (fs.existsSync(fullPath)) {
                return path.dirname(fullPath); // Return the dist directory
              }
            }
          }
        }
      } catch (error) {
        continue;
      }
    } else if (fs.existsSync(possiblePath)) {
      return path.dirname(possiblePath); // Return the dist directory
    }
  }
  
  return null;
}

/**
 * Find @stacks/network types
 */
function findStacksNetworkTypes(): string | null {
  const possiblePaths = [
    // Monorepo pnpm structure
    path.join(process.cwd(), '../../node_modules/.pnpm/@stacks+network@*/node_modules/@stacks/network/dist/index.d.ts'),
    // Local node_modules
    path.join(process.cwd(), 'node_modules/@stacks/network/dist/index.d.ts'),
    // Parent node_modules
    path.join(process.cwd(), '../node_modules/@stacks/network/dist/index.d.ts'),
    path.join(process.cwd(), '../../node_modules/@stacks/network/dist/index.d.ts'),
  ];

  for (const possiblePath of possiblePaths) {
    // Handle glob pattern for pnpm
    if (possiblePath.includes('*')) {
      const basePath = possiblePath.split('*')[0];
      const suffix = possiblePath.split('*')[1];
      
      try {
        const baseDir = path.dirname(basePath);
        if (fs.existsSync(baseDir)) {
          const entries = fs.readdirSync(baseDir);
          for (const entry of entries) {
            if (entry.startsWith('@stacks+network@')) {
              const fullPath = path.join(baseDir, entry, suffix);
              if (fs.existsSync(fullPath)) {
                return path.dirname(fullPath); // Return the dist directory
              }
            }
          }
        }
      } catch (error) {
        continue;
      }
    } else if (fs.existsSync(possiblePath)) {
      return path.dirname(possiblePath); // Return the dist directory
    }
  }
  
  return null;
}

/**
 * Process and resolve imports in type definitions
 */
function processImports(content: string, moduleName: string, baseDir: string): ProcessedImports {
  // Extract import statements
  const importRegex = /import\s+(?:{([^}]+)}|(\*\s+as\s+\w+)|(\w+))\s+from\s+['"]([^'"]+)['"];?/g;
  const imports: ImportStatement[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = importRegex.exec(content)) !== null) {
    const [fullMatch, namedImports, namespaceImport, defaultImport, modulePath] = match;
    imports.push({
      fullMatch,
      namedImports: namedImports?.split(',').map(s => s.trim()),
      namespaceImport,
      defaultImport,
      modulePath
    });
  }
  
  // Remove import statements from content
  const processedContent = content.replace(importRegex, '');
  
  // Add module declarations for external dependencies
  const moduleDeclarations: string[] = [];
  const processedModules = new Set<string>();
  
  for (const imp of imports) {
    const modulePath = imp.modulePath;
    
    // Skip relative imports for now - we'll handle them differently
    if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
      continue;
    }
    
    // Add module declarations for external packages
    if (!processedModules.has(modulePath)) {
      processedModules.add(modulePath);
      
      if (modulePath === '@stacks/common') {
        moduleDeclarations.push(`
declare module '@stacks/common' {
  export type IntegerType = string | number | bigint;
  export enum ChainID {
    Testnet = 2147483648,
    Mainnet = 1
  }
  export enum TransactionVersion {
    Mainnet = 0,
    Testnet = 128
  }
}`);
      } else if (modulePath === '@stacks/network') {
        moduleDeclarations.push(`
declare module '@stacks/network' {
  export type FetchFn = (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  export type StacksNetworkName = 'mainnet' | 'testnet' | 'devnet' | 'mocknet';
  export interface StacksNetwork {
    version: any;
    chainId: any;
    coreApiUrl: string;
    isMainnet(): boolean;
  }
}`);
      }
    }
  }
  
  return {
    content: processedContent,
    moduleDeclarations: moduleDeclarations
  };
}

/**
 * Read all .d.ts files and merge content
 */
function readAllTypeDefinitions(dir: string, moduleName: string): string {
  const typeContent: string[] = [];
  const allModuleDeclarations: string[] = [];
  
  try {
    // Key files to read for concrete type definitions
    const importantFiles = [
      'builders.d.ts',      // Contains makeContractCall, broadcastTransaction, etc.
      'clarity.d.ts',       // Contains Clarity value functions
      'constants.d.ts',     // Contains enums and constants
      'types.d.ts',         // Contains core type definitions
      'transaction.d.ts',   // Contains transaction types
      'keys.d.ts',          // Contains key utilities
      'utils.d.ts',         // Contains utility functions
      'network.d.ts',       // Network-related types (for @stacks/network)
    ];
    
    // Read clarity types from individual files for complete function definitions
    const clarityDir = path.join(dir, 'clarity');
    if (fs.existsSync(clarityDir)) {
      const clarityFiles = [
        'types/intCV.d.ts',
        'types/booleanCV.d.ts', 
        'types/stringCV.d.ts',
        'types/bufferCV.d.ts',
        'types/listCV.d.ts',
        'types/tupleCV.d.ts',
        'types/principalCV.d.ts',
        'types/optionalCV.d.ts',
        'types/responseCV.d.ts',
        'constants.d.ts',
        'clarityValue.d.ts'
      ];
      
      typeContent.push(`// Clarity Types and Functions`);
      for (const clarityFile of clarityFiles) {
        const clarityPath = path.join(clarityDir, clarityFile);
        const clarityContent = readTypeDefinition(clarityPath);
        if (clarityContent) {
          const processed = processImports(clarityContent, `${moduleName}/clarity`, dir);
          typeContent.push(`// From clarity/${clarityFile}`);
          typeContent.push(processed.content);
          typeContent.push('');
          allModuleDeclarations.push(...processed.moduleDeclarations);
        }
      }
    }
    
    // Read specific important files
    for (const fileName of importantFiles) {
      const filePath = path.join(dir, fileName);
      const content = readTypeDefinition(filePath);
      if (content) {
        const processed = processImports(content, moduleName, dir);
        typeContent.push(`// From ${fileName}`);
        typeContent.push(processed.content);
        typeContent.push('');
        allModuleDeclarations.push(...processed.moduleDeclarations);
      }
    }
    
  } catch (error) {
    console.warn(`⚠️  Error reading type definitions from ${dir}:`, error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Combine module declarations and content
  const uniqueDeclarations = [...new Set(allModuleDeclarations)];
  const finalContent = [
    ...uniqueDeclarations,
    '',
    ...typeContent
  ].join('\n');
  
  return finalContent;
}

/**
 * Main generation logic
 */
function generateTypes(): void {
  const stacksTransactionsDir = findStacksTransactionsTypes();
  const stacksNetworkDir = findStacksNetworkTypes();
  
  if (!stacksTransactionsDir) {
    console.error('❌ Could not find @stacks/transactions type definitions');
    process.exit(1);
  }

  console.log(`📁 Found @stacks/transactions types at: ${stacksTransactionsDir}`);
  if (stacksNetworkDir) {
    console.log(`📁 Found @stacks/network types at: ${stacksNetworkDir}`);
  }

  // Read comprehensive type definition files
  const typeDefinitions: TypeDefinitions = {};

  // @stacks/transactions - read multiple key files for complete types
  const stacksTransactionsTypes = readAllTypeDefinitions(stacksTransactionsDir, '@stacks/transactions');
  if (stacksTransactionsTypes.trim()) {
    typeDefinitions['@stacks/transactions'] = stacksTransactionsTypes;
  }

  // @stacks/network types (if available)
  if (stacksNetworkDir) {
    const stacksNetworkTypes = readAllTypeDefinitions(stacksNetworkDir, '@stacks/network');
    if (stacksNetworkTypes.trim()) {
      typeDefinitions['@stacks/network'] = stacksNetworkTypes;
    }
  }

  // Generate the TypeScript file
  const outputPath = path.join(process.cwd(), 'src', 'generated', 'types.ts');
  
  // Ensure the directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Wrap Stacks types in proper module declarations for Monaco
  const processedDefinitions: TypeDefinitions = {};
  
  Object.entries(typeDefinitions).forEach(([moduleName, content]) => {
    if (moduleName === '@stacks/transactions') {
      // Wrap @stacks/transactions content in a module declaration
      processedDefinitions[moduleName] = `declare module '@stacks/transactions' {
${content.split('\n').map(line => line ? `  ${line}` : '').join('\n')}
}`;
    } else if (moduleName === '@stacks/network') {
      // Wrap @stacks/network content in a module declaration  
      processedDefinitions[moduleName] = `declare module '@stacks/network' {
${content.split('\n').map(line => line ? `  ${line}` : '').join('\n')}
}`;
    } else {
      // Keep other modules as-is
      processedDefinitions[moduleName] = content;
    }
  });

  const generatedContent = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * 
 * This file contains TypeScript type definitions extracted from node_modules
 * at build time for use with Monaco Editor in client-side components.
 * 
 * Generated by: scripts/generate-types.ts
 * Generated at: ${new Date().toISOString()}
 */

export const typeDefinitions = {
${Object.entries(processedDefinitions).map(([moduleName, content]) => {
  // Escape the content for JavaScript string
  const escapedContent = content
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');
  
  return `  '${moduleName}': \`${escapedContent}\`,`;
}).join('\n')}
} as const;

/**
 * Custom bot context types that are specific to our application
 */
export const botContextTypes = \`
// Node.js globals
declare function require(id: string): any;
declare namespace NodeJS {
  interface Global {
    require: typeof require;
  }
}
declare var process: any;
declare var console: Console;
declare var Buffer: any;

// Bot context types
interface BotWalletCredentials {
  privateKey?: string;
}

interface BotContext {
  // Bot metadata
  id: string; // Bot ID is the wallet address
  name: string;
  status: 'active' | 'paused' | 'error' | 'inactive' | 'setup';
  created_at: string;
  last_active: string;
  walletCredentials: BotWalletCredentials;
}

declare const bot: BotContext;
\`;

/**
 * Get all type definitions for Monaco Editor
 */
export function getMonacoTypeDefinitions(): Array<{ content: string; filePath: string }> {
  const definitions: Array<{ content: string; filePath: string }> = [];
  
  // Add external package types
  Object.entries(typeDefinitions).forEach(([moduleName, content]) => {
    definitions.push({
      content,
      filePath: \`file:///node_modules/\${moduleName}/index.d.ts\`
    });
  });
  
  // Add custom bot context types
  definitions.push({
    content: botContextTypes,
    filePath: 'file:///node_modules/@types/strategy-globals/index.d.ts'
  });
  
  return definitions;
}
`;

  // Write the generated file
  fs.writeFileSync(outputPath, generatedContent, 'utf8');
  
  console.log(`✅ Generated type definitions: ${outputPath}`);
  console.log(`📊 Included ${Object.keys(typeDefinitions).length} external modules`);
  console.log('🎉 Type generation completed successfully!');
}

// Run the script
try {
  generateTypes();
} catch (error) {
  console.error('❌ Failed to generate types:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}