/**
 * Sandbox API Client
 * 
 * Client-side wrapper for making sandbox execution requests to the server.
 * Provides a simple interface for executing bot strategies via API calls.
 */

import type { StrategyExecutionResult } from "@/schemas/sandbox.schema";

export interface SandboxExecuteRequest {
  code: string;
  timeout?: number; // in minutes
  enableLogs?: boolean;
}

export interface SandboxExecuteResponse {
  success: boolean;
  result?: any;
  logs?: string[];
  error?: string;
  executionTime?: number;
  sandboxId?: string;
  botContext?: any;
}

export interface SandboxInfoResponse {
  botId: string;
  name: string;
  status: string;
  canExecute: boolean;
  supportedRuntimes: string[];
  maxTimeout: number;
}

export interface SandboxStreamEvent {
  type: 'status' | 'log' | 'error' | 'result' | 'done';
  level?: 'info' | 'warn' | 'error';
  message?: string;
  success?: boolean;
  result?: any;
  exitCode?: number;
  executionTime?: number;
  sandboxId?: string;
  botContext?: any;
  error?: string;
  timestamp: string;
}

/**
 * Execute a bot strategy via the sandbox API
 * 
 * @param botId - The bot ID to execute the strategy for
 * @param code - The strategy code to execute
 * @param options - Execution options
 * @returns Promise with execution result
 */
export async function executeStrategy(
  botId: string,
  code: string,
  options: {
    timeout?: number;
    enableLogs?: boolean;
  } = {}
): Promise<StrategyExecutionResult> {
  const requestBody: SandboxExecuteRequest = {
    code,
    timeout: options.timeout ?? 2,
    enableLogs: options.enableLogs ?? true
  };

  try {
    const response = await fetch(`/api/v1/bots/${botId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data: SandboxExecuteResponse = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`,
        executionTime: 0
      };
    }

    return {
      success: data.success,
      result: data.result,
      logs: data.logs,
      error: data.error,
      executionTime: data.executionTime || 0,
      sandboxId: data.sandboxId,
      botContext: data.botContext
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    
    return {
      success: false,
      error: `Failed to execute strategy: ${errorMessage}`,
      executionTime: 0
    };
  }
}

/**
 * Get sandbox execution info for a bot
 * 
 * @param botId - The bot ID to get info for
 * @returns Promise with bot execution capabilities
 */
export async function getSandboxInfo(botId: string): Promise<SandboxInfoResponse | null> {
  try {
    const response = await fetch(`/api/v1/bots/${botId}/execute`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();

  } catch (error) {
    console.error('Failed to get sandbox info:', error);
    return null;
  }
}

/**
 * Execute a bot strategy with real-time streaming logs
 * 
 * @param botId - The bot ID to execute the strategy for
 * @param code - The strategy code to execute
 * @param onEvent - Callback function to handle streaming events
 * @param options - Execution options
 */
export async function executeStrategyWithStreaming(
  botId: string,
  code: string,
  onEvent: (event: SandboxStreamEvent) => void,
  options: {
    timeout?: number;
    enableLogs?: boolean;
  } = {}
): Promise<void> {
  const requestBody: SandboxExecuteRequest = {
    code,
    timeout: options.timeout ?? 2,
    enableLogs: options.enableLogs ?? true
  };

  try {
    const response = await fetch(`/api/v1/bots/${botId}/execute-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      onEvent({
        type: 'error',
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      onEvent({
        type: 'error',
        error: 'No response body available',
        timestamp: new Date().toISOString()
      });
      return;
    }

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const eventData = JSON.parse(line.slice(6));
            onEvent(eventData);
            
            // Break on done event
            if (eventData.type === 'done') {
              return;
            }
          } catch {
            console.warn('Failed to parse SSE data:', line);
          }
        }
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    onEvent({
      type: 'error',
      error: `Failed to execute strategy: ${errorMessage}`,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Simple sandbox client object for easier usage
 */
export const sandboxClient = {
  executeStrategy,
  executeStrategyWithStreaming,
  getSandboxInfo
};