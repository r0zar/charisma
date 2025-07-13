# Execution Scripts

Scripts for managing bot execution logs in development and testing environments.

## Scripts Overview

### 🌱 `seed-execution-logs.ts`
Generates realistic execution logs for bots with various statuses and scenarios.

**Usage:**
```bash
# Quick development seeding (50 executions, 7 days)
npm run seed-executions

# Demo seeding with blob storage (100 executions, 30 days)
npm run seed-executions:demo

# Testing seeding (20 executions, 3 days)
npm run seed-executions:test

# Custom seeding
npm run seed-executions -- --count 25 --days 14 --generate-blobs
```

**Features:**
- Realistic execution scenarios (successful swaps, failures, timeouts)
- Historical timestamps over configurable date ranges
- Optional blob storage generation for testing
- Deterministic generation with seed support
- Profile-based configurations

### 🧹 `clear-execution-logs.ts`
Safely clears execution logs from KV storage and optionally blob storage.

**Usage:**
```bash
# Interactive clearing with confirmation
npm run clear-executions

# Auto-confirm clearing
npm run clear-executions:confirm

# Dry run to see what would be deleted
npm run clear-executions -- --dry-run

# Clear old executions only
npm run clear-executions -- --older-than 30

# Clear specific bot
npm run clear-executions -- --bot-id SP123... --confirm
```

**Safety Features:**
- Confirmation prompts for destructive operations
- Dry run mode for safe testing
- Selective clearing by bot or date
- Optional blob storage cleanup

### ⚙️ `execution-generator.ts`
Core utilities for generating realistic execution data.

**Scenarios Generated:**
- **Successful Swaps (40%)**: Realistic token swaps with transaction IDs
- **Failed Executions (25%)**: Common failure scenarios with error messages
- **Timeouts (15%)**: Network/execution timeouts
- **Monitoring (20%)**: Successful monitoring without actions

## Profile Configurations

| Profile | Executions | Days Past | Blob Storage |
|---------|------------|-----------|--------------|
| development | 50 | 7 | No |
| testing | 20 | 3 | No |
| demo | 100 | 30 | Yes |
| production | 0* | 0 | No |

*Production requires explicit `--count` override for safety

## Integration with Development Workflow

1. **Initial Setup**: Generate bots first using existing bot generation scripts
2. **Seed Executions**: Use `npm run seed-executions` for realistic test data
3. **Test Features**: Develop and test execution history features
4. **Clean Up**: Use `npm run clear-executions` to reset state
5. **Iterate**: Re-seed with different profiles as needed

## Advanced Usage

### Custom Seeding Scenarios
```bash
# Large dataset for performance testing
npm run seed-executions -- --count 500 --days 90

# Specific time period with blob storage
npm run seed-executions -- --days 7 --generate-blobs --clear-first

# Deterministic data for testing
npm run seed-executions -- --seed 12345 --count 20
```

### Selective Clearing
```bash
# Clear only old data
npm run clear-executions -- --older-than 7 --confirm

# Clear with blob cleanup (requires API access)
npm run clear-executions -- --clear-blobs --confirm

# Clear specific bot's executions
npm run clear-executions -- --bot-id SP1234... --dry-run
```

## Dependencies

- **KV Storage**: Uses existing `executionDataStore` for metadata
- **Blob Storage**: Optional `ExecutionLogService` for log content
- **Bot Data**: Requires bots to exist (use bot generation scripts first)
- **Environment**: Uses `NEXT_PUBLIC_DEFAULT_USER_ID` or fallback

## Error Handling

- Scripts gracefully handle missing dependencies
- Blob storage failures fall back to simulated metadata
- Partial failures are logged but don't stop execution
- Dry run mode allows safe testing without data changes

## File Structure

```
scripts/execution/
├── README.md                   # This file
├── execution-generator.ts      # Core generation utilities
├── seed-execution-logs.ts      # Seeding script
└── clear-execution-logs.ts     # Clearing script
```