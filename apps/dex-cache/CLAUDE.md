# DEX-Cache Development Guide

## pnpm script Workflow

### Command Syntax
```bash
# Basic usage
pnpm script <script-name> [args...]

# Examples
pnpm script test-contract-info                                    # Use default contract
pnpm script test-contract-info SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token
pnpm script test-recent-transactions 10                           # Get 10 recent transactions
pnpm script test-recent-transactions 5 contract_call              # Get 5 contract calls
pnpm script test-recent-transactions 20 token_transfer            # Get 20 token transfers
```

### Script Organization
- All scripts are located in `/scripts/` directory
- Each script is a TypeScript file (`.ts`) with proper type safety
- Scripts use the `#!/usr/bin/env tsx` shebang for direct execution
- The `run.js` script handles environment loading and execution

### Available Scripts (as of last update)
```
test-contract-info           - Test getContractInfo with real contracts
test-recent-transactions     - Test getRecentTransactions with filtering
test-account-balances        - Test account balance queries
test-energy-prices          - Test energy token price calculations
list-energy-vaults          - List all energy vaults in the system
analyze-pool-data           - Analyze liquidity pool data
debug-cache-performance     - Debug cache performance issues
validate-energy-contracts   - Validate energy contract integrity
... and many more
```

### Data Inspection Workflow

#### 1. API Testing and Debugging
Use scripts to test API endpoints and examine raw responses:
```bash
# Test blockchain API calls
pnpm script test-contract-info SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-alex
pnpm script test-recent-transactions 5 contract_call

# Test internal APIs
pnpm script test-account-balances SP1HTBVD3JG9C05J7HBJTHGR0GGS7RH5C1CQBVWX
```

#### 2. Data Administration
Use scripts for administrative tasks and data validation:
```bash
# Energy system administration
pnpm script validate-energy-contracts
pnpm script list-energy-vaults
pnpm script sync-energy-vault-data

# Pool and liquidity analysis
pnpm script analyze-pool-data
pnpm script list-lp-tokens
```

#### 3. Performance and Health Monitoring
Use scripts to monitor system health and performance:
```bash
# Cache performance
pnpm script debug-cache-performance
pnpm script initialize-raven-cache

# Energy system health
pnpm script validate-energy-tracker
pnpm script debug-energy-collective
```

### Script Development Best Practices

#### 1. Script Structure Template
```typescript
#!/usr/bin/env tsx

/**
 * Script description and usage
 * Usage: pnpm script script-name [args...]
 */

import { someFunction } from '@repo/polyglot';

async function main() {
  // Parse command line arguments
  const arg1 = process.argv[2] || 'default-value';
  
  console.log(`Testing ${arg1}...\\n`);
  
  try {
    const result = await someFunction(arg1);
    
    // Always show raw unedited response first
    console.log('=== RAW RESPONSE ===');
    console.log(JSON.stringify(result, null, 2));
    
    // Then provide analysis
    console.log('\\n=== ANALYSIS ===');
    // ... analysis code
    
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    console.error('Full error:', error);
  }
}

// Show usage information
function showUsage() {
  console.log('Usage: pnpm script script-name [param1] [param2]');
  console.log('\\nExamples:');
  console.log('  pnpm script script-name');
  console.log('  pnpm script script-name value1 value2');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run the script
main().catch(console.error);
```

#### 2. Debugging Output Guidelines
- **Always show raw responses first** - Use `JSON.stringify(result, null, 2)` for unedited API responses
- **Provide structured analysis** - Break down complex data into readable sections
- **Include error details** - Show both error messages and full error objects
- **Add parameter validation** - Validate inputs and show usage information

#### 3. Common Patterns
```typescript
// Parameter parsing with defaults
const limit = process.argv[2] ? parseInt(process.argv[2]) : 10;
const typeFilter = process.argv[3] as "contract_call" | "token_transfer" | undefined;

// Conditional parameter building
const params = {
  limit,
  offset: 0,
  ...(typeFilter && { type: [typeFilter] })
};

// Error handling with context
try {
  const result = await apiCall(params);
  // Process result
} catch (error: any) {
  if (error?.response?.status === 404) {
    console.warn(`Resource not found`);
    return null;
  }
  console.error('API call failed:', error);
  throw new Error('Failed to fetch data');
}
```

### Integration with @repo/polyglot

#### Importing Functions
```typescript
// Import specific functions
import { getContractInfo, getRecentTransactions, parseContractAbi } from '@repo/polyglot';

// Import types for better type safety
import type { ContractInfo, TransactionResults, Transaction } from '@repo/polyglot';
```

#### Testing New API Functions
1. Create a test script following the template above
2. Test with real data and examine raw responses
3. Update TypeScript interfaces in `@repo/polyglot/src/types.ts` based on real API responses
4. Export new types from `@repo/polyglot/src/index.ts`
5. Validate type accuracy with comprehensive testing

### Environment and Configuration

#### Environment Variables
Scripts automatically load environment variables from `.env.local`:
- `HIRO_API_KEY` - Required for Hiro Stacks API access
- Other app-specific variables as needed

#### TypeScript Configuration
- Scripts use `tsx` for TypeScript execution
- Full type checking with strict mode enabled
- Access to all workspace packages via `@repo/*` imports

### Troubleshooting Common Issues

#### Script Not Found
```bash
# Check available scripts
ls scripts/
# Or run without arguments to see list
node scripts/run.js
```

#### Import Errors
```bash
# Make sure to use workspace package names
import { getContractInfo } from '@repo/polyglot';  // ✅ Correct
import { getContractInfo } from '../packages/polyglot/src/index';  // ❌ Wrong
```

#### API Errors
```bash
# Test with simple cases first
pnpm script test-contract-info  # Uses default contract
# Then test with specific parameters
pnpm script test-contract-info SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token
```

### Notes for Future Development

- Always validate API response structures before updating TypeScript interfaces
- Use scripts to test edge cases and error conditions
- Keep scripts focused on single responsibilities
- Document usage patterns and common parameter combinations
- Use scripts for both development debugging and production data administration