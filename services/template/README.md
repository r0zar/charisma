# Service Template

A comprehensive template for creating new services in the Charisma ecosystem with best practices, testing infrastructure, and optimized development workflow.

## Features

### 🚀 Development Workflow
- **Type Safety First**: TypeScript type checking runs before all builds and tests
- **NPM Lifecycle Hooks**: Automatic type checking with `prebuild`, `pretest` commands
- **Fast Iteration**: `test:quick` bypasses type checking for rapid development
- **Watch Mode**: Live reload with coverage reporting

### 🧪 Testing Infrastructure
- **Comprehensive Mocking**: Pre-configured mocks for all common dependencies
- **High Coverage Standards**: 80%+ branch, 85%+ function/line coverage thresholds
- **Performance Testing**: Built-in utilities for load and stress testing
- **Memory Management**: Fork-based test isolation prevents memory leaks
- **Test Utilities**: Helper functions for common testing patterns

### 📦 Built-in Dependencies
- **Key-Value Store**: `@vercel/kv` for fast caching and indexing
- **Contract Analysis**: `@repo/polyglot` for blockchain contract interaction
- **Token Registry**: `@repo/tokens` for token metadata and discovery
- **Contract Utilities**: `@modules/contracts` for contract validation

## Quick Start

### 1. Copy Template
```bash
cp -r services/template services/your-new-service
cd services/your-new-service
```

### 2. Update Package Info
```bash
# Update package.json name and description
sed -i 's/@services\/template/@services\/your-new-service/g' package.json
```

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Start Development
```bash
# Run tests with type checking
npm run test

# Quick test iteration (skip type check)
npm run test:quick

# Watch mode with coverage
npm run test:watch

# Build with type checking
npm run build
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Type check + build distribution files |
| `npm run dev` | Start development server with watch mode |
| `npm run test` | Type check + run tests with coverage |
| `npm run test:quick` | Run tests without type checking |
| `npm run test:watch` | Watch mode with live coverage |
| `npm run test:ui` | Interactive test UI with coverage |
| `npm run check-types` | Run only TypeScript validation |
| `npm run lint` | Check code style |
| `npm run lint:fix` | Fix code style issues |

## Testing Features

### Pre-configured Mocks
All common dependencies are automatically mocked:

```typescript
// Available in all tests
import { mockUtils } from './setup';

// Setup KV operations
mockUtils.setupKvMocks({ 'key': 'value' });

// Setup blob storage
mockUtils.setupBlobMocks([{ name: 'test.json' }]);

// Setup contract analysis
mockUtils.setupContractMocks(contractInfo);

// Setup token listing
mockUtils.setupTokenMocks(tokens);

// Setup fetch responses
mockUtils.setupFetchMock({ data: 'response' });
```

### Test Fixtures
Comprehensive sample data generators:

```typescript
import { 
  mockFactory, 
  createSampleItem, 
  testUtils,
  ERROR_SCENARIOS 
} from './test-fixtures';

// Generate test data
const items = mockFactory.createItems(10);
const largeDataset = mockFactory.createLargeDataset(1000);

// Create sample objects
const item = createSampleItem('test-id', { status: 'inactive' });

// Utilities
await testUtils.wait(100);
const id = testUtils.randomId();
const pastTime = testUtils.pastTimestamp(2); // 2 hours ago
```

### Coverage Thresholds
Enforced quality standards:
- **85%** function coverage
- **85%** line coverage  
- **85%** statement coverage
- **80%** branch coverage

## Configuration

### Vitest Config
- **Environment**: happy-dom for fast DOM simulation
- **Isolation**: Fork-based test pools prevent memory leaks
- **Timeouts**: 30s test timeout, 10s hook timeout
- **Coverage**: V8 provider with HTML/JSON/LCOV reports

### TypeScript Integration
- Type checking runs automatically before builds and tests
- Use `test:quick` to skip type checking during development
- All TypeScript errors must be resolved before deployment

## Best Practices

### 1. Type Safety
```typescript
// Always define interfaces
interface ServiceConfig {
  serviceName: string;
  timeout?: number;
}

// Use strict typing
class MyService {
  constructor(private config: ServiceConfig) {}
}
```

### 2. Error Handling
```typescript
// Use predefined error scenarios
import { ERROR_SCENARIOS } from './test-fixtures';

it('should handle network errors', async () => {
  mockFetch.mockRejectedValue(ERROR_SCENARIOS.NETWORK_ERROR);
  await expect(service.fetchData()).rejects.toThrow('Network request failed');
});
```

### 3. Performance Testing
```typescript
import { PERFORMANCE_TEST_CONFIG } from './test-fixtures';

it('should handle large datasets efficiently', async () => {
  const data = mockFactory.createLargeDataset(PERFORMANCE_TEST_CONFIG.LARGE_DATASET);
  const startTime = Date.now();
  
  const result = await service.processData(data);
  const duration = Date.now() - startTime;
  
  expect(duration).toBeLessThan(PERFORMANCE_TEST_CONFIG.TIMEOUT_THRESHOLD);
});
```

### 4. Mock Management
```typescript
// Reset mocks properly
beforeEach(() => {
  vi.clearAllMocks();
  mockUtils.setupKvMocks(); // Reset to defaults
});

// Use specific mocks per test
it('should handle specific scenario', () => {
  mockUtils.setupBlobMocks([{ name: 'specific-file.json' }]);
  // Test logic here
});
```

## Architecture Patterns

### Service Class Structure
```typescript
export class MyService {
  constructor(private config: ServiceConfig) {}
  
  async processItem(id: string): Promise<ProcessResult> {
    // Implementation
  }
  
  async getStats(): Promise<ServiceStats> {
    // Implementation
  }
}
```

### Configuration Management
```typescript
interface ServiceConfig {
  serviceName: string;
  // Add service-specific config
}

export function createDefaultConfig(serviceName: string): ServiceConfig {
  return {
    serviceName,
    // Default values
  };
}
```

### Error Handling Patterns
```typescript
export class ServiceError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Use in service
throw new ServiceError('Operation failed', 'OPERATION_FAILED');
```

## Integration with Monorepo

### Workspace Dependencies
The template includes common workspace packages:
- `@modules/contracts` - Contract utilities
- `@repo/polyglot` - Multi-chain contract interaction
- `@repo/tokens` - Token registry and metadata

### Shared Configuration
- Inherits ESLint config from `@repo/eslint-config`
- Uses TypeScript config from `@repo/typescript-config`
- Follows monorepo build patterns with `bunchee`

## Migration from Existing Services

1. **Copy Core Logic**: Move your service classes to `src/`
2. **Update Tests**: Migrate to Vitest using the pre-configured mocks
3. **Add Type Safety**: Ensure all functions have proper TypeScript types
4. **Configure Coverage**: Adjust coverage thresholds if needed
5. **Update Package.json**: Use the enhanced script workflow

This template provides a solid foundation for building robust, well-tested services that integrate seamlessly with the Charisma ecosystem.