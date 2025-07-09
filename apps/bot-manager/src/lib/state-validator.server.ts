// Server-only state validation utilities
import { promises as fs } from 'fs';
import path from 'path';
import { StateValidationResult } from '@/types/app-state';
import { validateAppState } from './state-schema';

// Validate state without loading (for testing) - SERVER ONLY
export async function validateStateFile(filePath: string): Promise<StateValidationResult> {
  try {
    let data: any;
    
    // Check if this is a local file path or URL
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      // Use fetch for URLs
      const response = await fetch(filePath);
      
      if (!response.ok) {
        return {
          isValid: false,
          errors: [`Failed to load state from ${filePath}: ${response.status} ${response.statusText}`],
          warnings: [],
          metadata: {
            version: 'unknown',
            botCount: 0,
            totalActivities: 0,
            dataSize: 0,
          },
        };
      }
      
      data = await response.json();
    } else {
      // Use fs for local files (Node.js environment)
      try {
        // Resolve relative paths
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
        
        const fileContent = await fs.readFile(resolvedPath, 'utf-8');
        data = JSON.parse(fileContent);
      } catch (fileError) {
        return {
          isValid: false,
          errors: [`Failed to read file ${filePath}: ${fileError instanceof Error ? fileError.message : String(fileError)}`],
          warnings: [],
          metadata: {
            version: 'unknown',
            botCount: 0,
            totalActivities: 0,
            dataSize: 0,
          },
        };
      }
    }
    
    return validateAppState(data);
  } catch (error) {
    return {
      isValid: false,
      errors: [`Failed to parse state from ${filePath}: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      metadata: {
        version: 'unknown',
        botCount: 0,
        totalActivities: 0,
        dataSize: 0,
      },
    };
  }
}