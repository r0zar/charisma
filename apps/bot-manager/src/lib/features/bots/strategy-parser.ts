// Strategy parsing utilities

export interface StrategyMetadata {
  name: string;
  description: string;
  author?: string;
  schedule?: {
    cron: string;
    timezone?: string;
  };
  dependencies?: string[];
}

export interface ParsedStrategy {
  metadata: StrategyMetadata | null;
  isValid: boolean;
  errors: string[];
  hasExecuteFunction: boolean;
}

/**
 * Parse strategy code to extract metadata and validate structure
 */
export function parseStrategyCode(code: string): ParsedStrategy {
  const result: ParsedStrategy = {
    metadata: null,
    isValid: false,
    errors: [],
    hasExecuteFunction: false
  };

  if (!code || !code.trim()) {
    result.errors.push('Strategy code is empty');
    return result;
  }

  try {
    // Check for metadata export
    const metadataMatch = code.match(/export\s+const\s+metadata\s*=\s*({[\s\S]*?});/);
    if (!metadataMatch) {
      result.errors.push('No metadata export found. Please add: export const metadata = {...}');
    } else {
      try {
        // Create a safe evaluation context
        const metadataStr = metadataMatch[1];
        
        // Replace any potentially dangerous code patterns
        const safeMetadataStr = metadataStr
          .replace(/require\s*\(/g, 'null;(') // Disable require
          .replace(/import\s+/g, 'null;import ') // Disable imports
          .replace(/process\./g, 'null.') // Disable process access
          .replace(/global\./g, 'null.') // Disable global access
          .replace(/window\./g, 'null.'); // Disable window access
        
        // Use Function constructor for safer evaluation than eval
        const evalFn = new Function(`return ${  safeMetadataStr}`);
        const metadata = evalFn();
        
        // Validate required metadata fields
        if (!metadata.name || typeof metadata.name !== 'string') {
          result.errors.push('Metadata must have a valid name field');
        }
        if (!metadata.description || typeof metadata.description !== 'string') {
          result.errors.push('Metadata must have a valid description field');
        }
        
        // Validate schedule if present
        if (metadata.schedule) {
          if (!metadata.schedule.cron || typeof metadata.schedule.cron !== 'string') {
            result.errors.push('Schedule must have a valid cron field');
          }
        }
        
        if (result.errors.length === 0) {
          result.metadata = metadata;
        }
      } catch (error) {
        result.errors.push(`Invalid metadata format: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Check for execute function export
    const executeMatch = code.match(/export\s+default\s+(?:async\s+)?function\s+execute\s*\(/);
    if (!executeMatch) {
      result.errors.push('No default execute function found. Please add: export default async function execute({...}) {...}');
    } else {
      result.hasExecuteFunction = true;
    }

    // Additional syntax validation - skip for now since we're using ES6 modules
    // ES6 modules with export/import can't be validated with Function constructor
    // The actual validation will happen during execution in the sandbox environment

    result.isValid = result.errors.length === 0 && result.metadata !== null && result.hasExecuteFunction;

  } catch (error) {
    result.errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
  }

  return result;
}

/**
 * Simple hash function for generating strategy names
 */
function simpleHash(str: string): string {
  if (!str) return '0';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Extract strategy name from metadata or provide fallback
 */
export function getStrategyDisplayName(code: string): string {
  const parsed = parseStrategyCode(code);
  if (parsed.metadata?.name) {
    return parsed.metadata.name;
  }
  
  // Generate hash-based name for custom strategies
  const hash = simpleHash(code);
  return `0x${hash.slice(0, 8).toLowerCase()}`;
}

/**
 * Extract strategy type/category from metadata or code analysis
 */
export function getStrategyType(code: string): string {
  const parsed = parseStrategyCode(code);
  
  // Check metadata name for type hints
  if (parsed.metadata?.name) {
    const name = parsed.metadata.name.toLowerCase();
    if (name.includes('yield') || name.includes('farm')) return 'yield-farming';
    if (name.includes('arbitrage')) return 'arbitrage';
    if (name.includes('dca') || name.includes('dollar')) return 'dca';
    if (name.includes('liquidity') || name.includes('mining')) return 'liquidity-mining';
  }

  // Analyze code content for type hints
  const codeLower = code.toLowerCase();
  if (codeLower.includes('claimrewards') || codeLower.includes('addliquidity')) return 'yield-farming';
  if (codeLower.includes('arbitrage') || codeLower.includes('exchangeprices')) return 'arbitrage';
  if (codeLower.includes('swaphelper') || codeLower.includes('purchaseamount')) return 'dca';
  if (codeLower.includes('liquiditypool') || codeLower.includes('mining')) return 'liquidity-mining';

  return 'custom';
}

/**
 * Format cron expression to human readable string
 */
export function formatCronExpression(cron: string): string {
  try {
    // Basic cron format: minute hour day month dayOfWeek
    const parts = cron.split(' ');
    if (parts.length !== 5) return cron;

    const [minute, hour, day, month, dayOfWeek] = parts;

    // Common patterns
    if (cron === '0 */6 * * *') return 'Every 6 hours';
    if (cron === '*/5 * * * *') return 'Every 5 minutes';
    if (cron === '0 12 * * *') return 'Daily at noon';
    if (cron === '0 0 * * *') return 'Daily at midnight';
    if (cron === '0 */1 * * *') return 'Every hour';
    if (cron === '*/15 * * * *') return 'Every 15 minutes';
    if (cron === '0 0 * * 0') return 'Weekly on Sunday';

    // Generic formatting
    let result = '';
    
    if (minute.startsWith('*/')) {
      result += `Every ${minute.slice(2)} minutes`;
    } else if (minute === '0') {
      if (hour.startsWith('*/')) {
        result += `Every ${hour.slice(2)} hours`;
      } else if (hour !== '*') {
        result += `Daily at ${hour}:00`;
      }
    }

    return result || cron;
  } catch {
    return cron;
  }
}

/**
 * Get default strategy templates
 */
export function getStrategyTemplates() {
  return {
    helloWorld: {
      name: 'Hello World',
      description: 'Simple logging example',
      type: 'custom',
      code: `console.log('🚀 Starting strategy for', bot.name);
console.log('Balance:', bot.balance.STX, 'STX');

if (bot.balance.STX > 1000000) {
  await bot.swap('STX', 'USDA', 500000);
  console.log('✅ Swap completed');
}`
    },
    
    fetchExample: {
      name: 'Fetch Example',
      description: 'HTTP request and logging',
      type: 'custom',
      code: `console.log('🚀 Starting fetch strategy for', bot.name);

try {
  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
  const data = await response.json();
  console.log('📊 Bitcoin price data:', data.bitcoin.usd);
  
  console.log('Current bot balance:', bot.balance.STX, 'STX');
} catch (error) {
  console.log('❌ Fetch failed:', error.message);
}`
    }
  };
}