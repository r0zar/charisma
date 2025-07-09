// State Loader - Functions to load and manage app state from JSON
import { AppState, StateValidationResult } from '@/types/app-state';
import { validateAppState, isValidAppState } from './state-schema';

// Default state file path
const DEFAULT_STATE_PATH = '/data/app-state.json';

// State loading errors
export class StateLoadError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'StateLoadError';
  }
}

// Load state from JSON file or URL
export async function loadAppState(path: string = DEFAULT_STATE_PATH): Promise<AppState> {
  try {
    const response = await fetch(path);
    
    if (!response.ok) {
      throw new StateLoadError(`Failed to load state from ${path}: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Validate the loaded data
    const validation = validateAppState(data);
    
    if (!validation.isValid) {
      throw new StateLoadError(`Invalid state data: ${validation.errors.join(', ')}`);
    }
    
    // Log warnings if any
    if (validation.warnings.length > 0) {
      console.warn('State validation warnings:', validation.warnings);
    }
    
    return data as AppState;
  } catch (error) {
    if (error instanceof StateLoadError) {
      throw error;
    }
    
    throw new StateLoadError(
      `Failed to load or parse state from ${path}`, 
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

// Load state with fallback to default
export async function loadAppStateWithFallback(path: string = DEFAULT_STATE_PATH): Promise<AppState> {
  try {
    return await loadAppState(path);
  } catch (error) {
    console.warn('Failed to load state, falling back to default:', error);
    return await loadAppState('/data/default-state.json');
  }
}

// Note: validateStateFile function moved to server-only utils to prevent Node.js imports in client bundle

// Save state to localStorage (for persistence)
export function saveStateToStorage(state: AppState, key: string = 'app-state'): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
}

// Load state from localStorage
export function loadStateFromStorage(key: string = 'app-state'): AppState | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    
    if (!isValidAppState(data)) {
      console.warn('Invalid state in localStorage, clearing...');
      localStorage.removeItem(key);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
    return null;
  }
}

// Clear state from localStorage
export function clearStateFromStorage(key: string = 'app-state'): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear state from localStorage:', error);
  }
}

// Get state metadata without loading full state
export async function getStateMetadata(path: string = DEFAULT_STATE_PATH): Promise<{
  version: string;
  generatedAt: string;
  profile: string;
  size: number;
} | null> {
  try {
    const response = await fetch(path);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    return {
      version: data.metadata?.version || 'unknown',
      generatedAt: data.metadata?.generatedAt || 'unknown',
      profile: data.metadata?.profile || 'unknown',
      size: JSON.stringify(data).length,
    };
  } catch (error) {
    console.error('Failed to get state metadata:', error);
    return null;
  }
}

// Check if state file exists
export async function stateFileExists(path: string = DEFAULT_STATE_PATH): Promise<boolean> {
  try {
    const response = await fetch(path, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Load multiple state files (for comparison or merging)
export async function loadMultipleStates(paths: string[]): Promise<{
  states: AppState[];
  errors: string[];
}> {
  const states: AppState[] = [];
  const errors: string[] = [];
  
  for (const path of paths) {
    try {
      const state = await loadAppState(path);
      states.push(state);
    } catch (error) {
      errors.push(`Failed to load ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return { states, errors };
}

// State comparison utilities
export function compareStates(stateA: AppState, stateB: AppState): {
  identical: boolean;
  differences: string[];
} {
  const differences: string[] = [];
  
  // Compare metadata
  if (stateA.metadata.version !== stateB.metadata.version) {
    differences.push(`Version: ${stateA.metadata.version} vs ${stateB.metadata.version}`);
  }
  
  if (stateA.metadata.profile !== stateB.metadata.profile) {
    differences.push(`Profile: ${stateA.metadata.profile} vs ${stateB.metadata.profile}`);
  }
  
  // Compare bot counts
  if (stateA.bots.list.length !== stateB.bots.list.length) {
    differences.push(`Bot count: ${stateA.bots.list.length} vs ${stateB.bots.list.length}`);
  }
  
  // Compare activity counts
  if (stateA.bots.activities.length !== stateB.bots.activities.length) {
    differences.push(`Activity count: ${stateA.bots.activities.length} vs ${stateB.bots.activities.length}`);
  }
  
  // Compare pool counts
  if (stateA.market.pools.length !== stateB.market.pools.length) {
    differences.push(`Pool count: ${stateA.market.pools.length} vs ${stateB.market.pools.length}`);
  }
  
  // Compare notification counts
  if (stateA.notifications.length !== stateB.notifications.length) {
    differences.push(`Notification count: ${stateA.notifications.length} vs ${stateB.notifications.length}`);
  }
  
  // Compare wallet connection
  if (stateA.user.wallet.isConnected !== stateB.user.wallet.isConnected) {
    differences.push(`Wallet connected: ${stateA.user.wallet.isConnected} vs ${stateB.user.wallet.isConnected}`);
  }
  
  return {
    identical: differences.length === 0,
    differences,
  };
}

// Export main functions
export default loadAppState;