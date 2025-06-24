# Charisma DeFi Platform

A comprehensive monorepo for decentralized finance applications built on Stacks, featuring advanced trading tools, token infrastructure, and real-time data services.

## Monorepo Structure

This repository contains multiple interconnected applications and shared packages for the Charisma ecosystem.

### Applications

#### Core Trading Platform
- **`simple-swap`**: Main DEX interface with limit orders, DCA strategies, and advanced trading features
- **`pro-interface`**: Professional trading tools with charts and analytics
- **`dex-cache`**: Price discovery, liquidity analysis, and market data caching

#### Infrastructure Services  
- **`blaze-signer`**: Transaction signing, verification, and intent management
- **`token-cache`**: Token metadata caching and validation service
- **`metadata`**: Token and contract metadata management
- **`charisma-party`**: Real-time data feeds powered by PartyKit

#### Developer Tools
- **`contract-search`**: Smart contract discovery and analysis
- **`launchpad`**: Token creation and contract deployment tools
- **`docs`**: Technical documentation and API references

#### Applications
- **`meme-roulette`**: Gaming application with token mechanics

### Shared Packages

- **`@repo/tokens`**: Token metadata library and caching utilities
- **`@repo/ui`**: Shared UI component library
- **`@repo/eslint-config`**: ESLint configurations across packages
- **`@repo/typescript-config`**: TypeScript configurations

## Technology Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict typing
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui with custom extensions
- **Charts**: Lightweight Charts for trading interfaces
- **State Management**: React Context with optimized patterns

### Backend & Data
- **Database**: Vercel KV (Redis-compatible key-value store)
- **File Storage**: Vercel Blob for large assets and logs
- **Real-time**: PartyKit for WebSocket connections and live updates
- **Blockchain**: Stacks integration via Blaze SDK
- **APIs**: RESTful endpoints with Next.js API routes

### Infrastructure
- **Monorepo**: Turborepo for build optimization and caching
- **Package Manager**: pnpm with workspaces
- **Deployment**: Vercel for all applications
- **CI/CD**: Automated builds and testing pipelines

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended package manager)
- Git

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd charisma
   pnpm install
   ```

2. **Environment configuration**
   ```bash
   # Copy environment templates for required apps
   cp apps/simple-swap/.env.example apps/simple-swap/.env.local
   cp apps/dex-cache/.env.example apps/dex-cache/.env.local
   # Configure environment variables for each app
   ```

3. **Development**
   ```bash
   # Start all development servers
   pnpm dev
   
   # Or start specific applications
   pnpm dev --filter=simple-swap
   pnpm dev --filter=dex-cache
   ```

### Monorepo Commands

```bash
# Development
pnpm dev                    # Start all applications
pnpm dev --filter=<app>     # Start specific application
pnpm build                  # Build all packages and applications
pnpm test                   # Run all tests
pnpm lint                   # Lint all packages
pnpm clean                  # Clean all build artifacts

# Package management
pnpm install                # Install all dependencies
pnpm install <pkg>          # Add dependency to root
pnpm add <pkg> --filter=<app>  # Add dependency to specific app
```

## Architecture

### Inter-App Communication

- **simple-swap** ↔ **dex-cache**: Price data and liquidity information
- **simple-swap** ↔ **blaze-signer**: Transaction signing and execution
- **token-cache** → **All Apps**: Centralized token metadata
- **charisma-party** → **All Apps**: Real-time updates via WebSocket

### Shared Services

#### Token Infrastructure
- Centralized token metadata in `@repo/tokens`
- Caching layer via `token-cache` application
- Validation and enrichment in `metadata` service

#### Real-time Data
- PartyKit servers for live price feeds
- WebSocket connections for order updates
- Shared state management across applications

#### Development Tools
- Shared TypeScript configurations
- Common ESLint rules and Prettier setup
- UI component library for consistent interfaces

## Environment Configuration

### Core Variables (All Apps)
```bash
# Vercel KV
KV_REST_API_URL=           # Vercel KV REST API URL
KV_REST_API_TOKEN=         # Vercel KV authentication token

# Vercel Blob  
BLOB_READ_WRITE_TOKEN=     # Blob storage access token

# PartyKit
PARTYKIT_HOST=             # PartyKit host for real-time features

# Stacks Network
NEXT_PUBLIC_STACKS_API_URL=# Stacks API endpoint
NEXT_PUBLIC_NETWORK=       # mainnet/testnet
```

### App-Specific Variables
Each application has additional environment requirements documented in their respective README files.

## Development Workflow

### Working with Multiple Apps

1. **Local Development**
   ```bash
   # Terminal 1: Start shared services
   pnpm dev --filter=token-cache --filter=charisma-party
   
   # Terminal 2: Start main applications  
   pnpm dev --filter=simple-swap --filter=dex-cache
   ```

2. **Testing Changes**
   ```bash
   # Test specific app
   pnpm test --filter=simple-swap
   
   # Test affected packages
   pnpm test --filter=...@repo/tokens
   ```

3. **Building for Production**
   ```bash
   # Build all packages first, then applications
   pnpm build --filter=@repo/*
   pnpm build --filter=simple-swap
   ```

### Code Organization

- **Shared logic**: Place in `packages/` directory
- **App-specific code**: Keep within respective `apps/` directory
- **Cross-app utilities**: Use `@repo/` scoped packages
- **API integrations**: Centralize in shared packages when possible

## Data Flow

### Price Data Pipeline
1. **dex-cache**: Fetches and processes market data
2. **Vercel KV**: Caches processed price information
3. **charisma-party**: Broadcasts real-time updates
4. **simple-swap**: Consumes data for trading interface

### Order Management
1. **simple-swap**: User creates orders
2. **blaze-signer**: Signs and validates transactions
3. **Vercel KV**: Stores order state and history
4. **charisma-party**: Real-time order status updates

### Token Information
1. **token-cache**: Maintains metadata cache
2. **metadata**: Enriches token information
3. **@repo/tokens**: Provides typed interfaces
4. **All Apps**: Consume consistent token data

## API Documentation

### Internal APIs
- **Token Cache API**: `/api/v1/tokens/*` - Token metadata and validation
- **Price API**: `/api/v1/prices/*` - Real-time and historical pricing
- **Order API**: `/api/v1/orders/*` - Order management and execution

### External Integrations
- **Stacks API**: Blockchain data and transaction broadcasting
- **PartyKit**: Real-time WebSocket connections
- **Vercel Storage**: KV and Blob storage operations

## Deployment

### Application Deployment
Each application deploys independently to Vercel:

```bash
# Deploy specific application
cd apps/simple-swap
vercel deploy

# Deploy with environment variables
vercel deploy --env ENVIRONMENT=production
```

### Shared Dependencies
- Packages are built automatically during application deployment
- Turborepo handles build optimization and caching
- Dependencies are resolved across the entire monorepo

### Environment Management
- Production variables configured in Vercel dashboard
- Staging environments use separate KV and Blob instances
- PartyKit environments isolated per deployment

## Testing

### Test Strategy
- **Unit Tests**: Individual component and utility testing
- **Integration Tests**: Cross-package functionality
- **E2E Tests**: Full application workflows
- **API Tests**: Backend service validation

### Running Tests
```bash
# All tests
pnpm test

# Specific application tests
pnpm test --filter=simple-swap

# Shared package tests
pnpm test --filter=@repo/tokens

# Watch mode for development
pnpm test:watch --filter=simple-swap
```

## Contributing

### Development Guidelines
1. Follow TypeScript strict typing
2. Use shared UI components from `@repo/ui`
3. Maintain test coverage for new features
4. Update documentation for API changes
5. Follow conventional commit messages

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes with tests
3. Run `pnpm lint` and `pnpm test`
4. Update relevant documentation
5. Submit PR with clear description

### Code Quality
- ESLint and Prettier enforce consistent formatting
- TypeScript ensures type safety across packages
- Automated testing validates functionality
- Performance monitoring tracks application health

## Documentation

- **Application READMEs**: Each app has specific setup instructions
- **API Documentation**: Available in `/docs` application
- **Component Library**: Documented in `packages/ui`
- **Technical Guides**: Located in `/docs` for complex integrations

## Troubleshooting

### Common Issues
- **Build Errors**: Run `pnpm clean` then `pnpm install`
- **Type Errors**: Ensure shared packages are built first
- **Environment Variables**: Check all required variables are set
- **Port Conflicts**: Applications use different ports by default

### Debug Mode
Set `DEBUG=true` in environment variables for detailed logging across all applications.

---

Built by the Charisma team for the Stacks ecosystem.