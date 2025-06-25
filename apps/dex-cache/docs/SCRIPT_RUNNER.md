# Script Runner System Documentation

The DEX Cache application includes a powerful script runner system that allows you to execute TypeScript scripts with proper environment loading and dependency resolution.

## Overview

The script runner system consists of:
- **Main runner**: `scripts/run.js` - Entry point for all script execution
- **Package.json script**: `pnpm script <script-name>` - Easy command interface
- **Environment loading**: Automatic `.env` file detection and loading
- **TypeScript support**: Direct execution of `.ts` files using `tsx`

## Quick Start

```bash
# List available scripts
pnpm script list

# Run a specific script
pnpm script <script-name>

# Run with arguments
pnpm script <script-name> arg1 arg2

# Set environment variables
DATABASE_URL=xxx pnpm script analyze-pools
```

## Environment Loading

The script runner automatically loads environment variables from multiple sources in order:

1. `.env.local` (highest priority)
2. `.env.development.local`
3. `.env.development`
4. `.env` (lowest priority)

Environment files are searched for in the project root directory.

### Example Output
```
📁 Loaded environment from: .env.local
🚀 Running script: validate-energy-contracts
```

## Available Scripts

### Energy System Validation Scripts

#### `validate-energy-contracts`
Validates energy contracts using polyglot library integration.
- **Purpose**: Ensure energy contracts are accessible and properly structured
- **What it does**: 
  - Fetches energy vault configurations
  - Analyzes contract source code for relationships
  - Validates contract interfaces and functions
  - Generates comprehensive validation report
- **Key discoveries**: Contract-call patterns, trait implementations, token references

#### `validate-energy-data-integrity`
Tests energy contract function integrity (read-only functions only).
- **Purpose**: Verify contract functions work correctly without requiring signatures
- **What it does**:
  - Tests `quote()` function on energize vault
  - Tests `get-token-uri()` for metadata retrieval
  - Tests `get-last-tap-block()` on hold-to-earn engine
  - Measures response times and validates return values
- **Important**: Only tests read-only functions (public functions require wallet signatures)

#### `discover-token-relationships`
Discovers relationships between energy contracts, vaults, and tokens.
- **Purpose**: Map the energy system architecture and token dependencies
- **What it does**:
  - Analyzes vault configurations and contract source code
  - Builds relationship graph between contracts
  - Identifies vault-engine, vault-token, and trait relationships
  - Generates network topology report

#### `audit-energy-contract-source`
Performs security audit of energy contract source code.
- **Purpose**: Identify security issues, gas optimization opportunities, and best practices
- **What it does**:
  - Scans for common security patterns
  - Checks for proper error handling
  - Analyzes function design and complexity
  - Provides risk assessment and recommendations

#### `sync-energy-vault-data`
Synchronizes vault configuration with live contract data.
- **Purpose**: Detect mismatches between vault config and actual contract state
- **What it does**:
  - Compares vault configuration with contract source code
  - Tests contract function accessibility
  - Identifies configuration drift
  - Provides sync recommendations

### Contract Analysis Scripts

#### `test-energize-contract`
Comprehensive test of the energize vault contract functions.
- **Purpose**: Deep dive testing of the main energy contract
- **What it does**:
  - Tests contract interface discovery
  - Validates read-only function calls
  - Analyzes contract relationships and architecture
  - Extracts contract metadata and constants

#### `test-contract-analysis`
Tests the contract analysis library functionality.
- **Purpose**: Validate the contract-analysis.ts backend library
- **What it does**:
  - Tests contract relationship extraction
  - Validates energy system architecture discovery
  - Demonstrates contract type classification
  - Shows relationship confidence scoring

#### `check-contract-interface`
Analyzes contract interfaces to identify available functions.
- **Purpose**: Understand what functions are callable vs require signatures
- **What it does**:
  - Fetches contract interface from Stacks API
  - Categorizes functions by access level (read-only, public, private)
  - Identifies which functions can be tested without wallet signatures
  - Provides function signature information

## Script Structure

### Basic Script Template

```typescript
// Import required dependencies
import { someFunction } from '../src/lib/some-service';

async function myScript() {
    console.log('🚀 Starting My Script');
    console.log('');
    
    try {
        // Script logic here
        
        console.log('✨ Script complete!');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Run the script
myScript().catch(console.error);
```

### Environment Check Pattern

```typescript
console.log('🔧 Environment Check:');
console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`  KV_URL: ${process.env.KV_URL ? 'set ✅' : 'not set ❌'}`);
console.log(`  HIRO_API_KEY: ${process.env.HIRO_API_KEY ? 'set ✅' : 'not set ❌'}`);
console.log('');
```

## File Locations

```
apps/dex-cache/
├── scripts/
│   ├── run.js                           # Main script runner
│   ├── validate-energy-contracts.ts     # Contract validation
│   ├── validate-energy-data-integrity.ts # Function testing
│   ├── discover-token-relationships.ts  # Relationship mapping
│   ├── audit-energy-contract-source.ts  # Security audit
│   ├── sync-energy-vault-data.ts       # Data synchronization
│   ├── test-energize-contract.ts       # Energize contract testing
│   ├── test-contract-analysis.ts       # Library testing
│   └── check-contract-interface.ts     # Interface analysis
├── src/lib/
│   └── contract-analysis.ts            # Backend analysis library
└── package.json                        # Defines "script" command
```

## Script Runner Implementation

### Main Runner (`scripts/run.js`)

```javascript
#!/usr/bin/env node

// Key features:
// - Environment file detection and loading
// - TypeScript file execution via tsx
// - Argument passing to scripts
// - Error handling and exit codes
// - Script listing functionality
```

### Package.json Integration

```json
{
  "scripts": {
    "script": "node scripts/run.js"
  }
}
```

## Usage Examples

### List Available Scripts
```bash
pnpm script list
# Shows all .ts and .js files in scripts/ directory
```

### Run Energy Validation
```bash
pnpm script validate-energy-contracts
# Validates all energy contracts and generates report
```

### Run with Environment Variables
```bash
HIRO_API_KEY=your_key pnpm script test-energize-contract
# Sets environment variable for single script execution
```

### Debug Mode
```bash
DEBUG=1 pnpm script validate-energy-data-integrity
# Run with debug output (if script supports it)
```

## Key Features

### 1. Environment Management
- Automatic `.env` file detection
- Multiple environment file support
- Clear environment status reporting

### 2. TypeScript Support
- Direct `.ts` file execution
- No compilation step required
- Full dependency resolution

### 3. Error Handling
- Graceful error reporting
- Proper exit codes
- Script validation before execution

### 4. Argument Support
- Pass arguments to scripts
- Environment variable override
- Flexible parameter handling

## Best Practices

### Script Development
1. **Always include error handling** with try/catch blocks
2. **Use descriptive console output** with emojis for clarity
3. **Exit with appropriate codes** (0 for success, 1 for error)
4. **Check environment variables** at script start
5. **Provide progress feedback** for long-running operations

### Console Output Standards
- 🚀 Script start
- 📊 Data fetching
- ✅ Success operations
- ❌ Error conditions  
- ⚠️ Warnings
- 💡 Recommendations
- ✨ Script completion

### Environment Variables
Required for energy scripts:
- `KV_URL` - Vercel KV database connection
- `HIRO_API_KEY` - Stacks blockchain API access

## Troubleshooting

### Common Issues

#### "Script not found"
```bash
❌ Script not found: my-script
```
**Solution**: Check script exists in `scripts/` directory with `.ts` or `.js` extension

#### "No .env files found"
```bash
⚠️  No .env files found
```
**Solution**: Create `.env.local` file with required environment variables

#### "Module not found"
```bash
❌ Error running script: Cannot find module '@repo/polyglot'
```
**Solution**: Run `pnpm install` to install dependencies

### Debug Tips

1. **Check environment loading**:
   ```bash
   pnpm script list
   # Should show environment file loading
   ```

2. **Verify script syntax**:
   ```bash
   npx tsx scripts/your-script.ts
   # Run directly with tsx for syntax errors
   ```

3. **Test dependencies**:
   ```bash
   pnpm script test-contract-analysis
   # Test the backend library functions
   ```

## Integration with Energy Admin

The script runner system integrates with the energy admin dashboard by:

1. **Providing validation data** for contract health monitoring
2. **Generating reports** used in admin interface
3. **Testing contract functions** that power the dashboard
4. **Discovering relationships** shown in the admin UI

## Future Enhancements

Potential improvements to the script runner system:

1. **Scheduled execution** via cron or GitHub Actions
2. **Result caching** for expensive operations
3. **Email/Slack notifications** for critical issues
4. **Web interface** for script execution
5. **Parallel execution** for independent scripts
6. **Result persistence** to database or files

## Contributing

When adding new scripts:

1. Follow the naming convention: `action-target.ts`
2. Include comprehensive error handling
3. Use the standard console output format
4. Document the script purpose and usage
5. Test with various environment configurations
6. Update this documentation

---

The script runner system provides a robust foundation for energy system monitoring, validation, and analysis. It enables rapid development of diagnostic tools and integration testing without requiring complex build processes or deployment procedures.