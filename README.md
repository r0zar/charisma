# Charisma DeFi Platform

A comprehensive monorepo for decentralized finance applications built on Stacks, featuring advanced trading tools, token infrastructure, and real-time data services.

---

## Monorepo Structure

Charisma uses a modern monorepo architecture powered by Turborepo and pnpm workspaces. The codebase is organized for clarity, scalability, and developer velocity.

### Directory Layout

```
/apps/         # Application entrypoints (Next.js, CLI, etc.)
/modules/      # Internal shared logic, adapters, business logic, types (not published)
/services/     # Deployable backend services (APIs, workers, daemons, etc.)
/packages/     # Public packages (SDKs, libraries, config, for external npm publishing)
/docs/         # Technical documentation and API references
/scripts/      # Utility scripts for development and automation
```

### Directory Purpose

| Directory   | Purpose                       | Publishes to npm? | Example Contents        |
|-------------|-------------------------------|-------------------|-------------------------|
| apps/       | User-facing applications      | No                | simple-swap, dex-cache  |
| modules/    | Internal shared logic/modules | No                | db-adapter, types, core |
| services/   | Deployable backend services   | No                | user-api, party-service |
| packages/   | Public packages/libraries     | Yes               | blaze-sdk, dexterity    |

---

## Applications

- **simple-swap**: Main DEX interface with limit orders, DCA strategies, and advanced trading features
- **pro-interface**: Professional trading tools with charts and analytics
- **dex-cache**: Price discovery, liquidity analysis, and market data caching
- **token-cache**: Token metadata caching and validation service
- **metadata**: Token and contract metadata management
- **charisma-party**: Real-time data feeds powered by PartyKit
- **blaze-signer**: Experimental playground for transaction signing, verification, and intent management concepts
- **contract-search**: Smart contract discovery and analysis
- **launchpad**: Token creation and contract deployment tools
- **meme-roulette**: Gaming application with token mechanics

---

## Internal Modules

- **discovery**: Environment/hostname discovery and validation
- *(Add more as your codebase evolves)*

---

## Services

- *(Add more as your backend grows)*

---

## Public Packages

- **@repo/blaze-sdk**: Stacks blockchain SDK for external developers
- **@repo/tx-monitor-client**: Transaction monitoring client
- **@repo/tokens**: Token metadata library and caching utilities
- **@repo/ui**: Shared UI component library
- **@repo/eslint-config**: ESLint configurations for external use
- **@repo/typescript-config**: TypeScript configurations for external use

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui with custom extensions
- **Charts**: Lightweight Charts for trading interfaces
- **State Management**: React Context

### Backend & Data
- **Database**: Vercel KV (Redis-compatible key-value store)
- **File Storage**: Vercel Blob
- **Real-time**: PartyKit for WebSocket connections
- **Blockchain**: Stacks integration via Blaze SDK
- **APIs**: RESTful endpoints with Next.js API routes

### Infrastructure
- **Monorepo**: Turborepo for build optimization and caching
- **Package Manager**: pnpm with workspaces
- **Deployment**: Vercel for all applications
- **CI/CD**: Automated builds and testing pipelines

---

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended)
- Git

### Installation

```bash
git clone <repository-url>
cd charisma
pnpm install
```

### Environment Configuration

Copy and configure environment variables for each app/service as needed:

```bash
cp apps/simple-swap/.env.example apps/simple-swap/.env.local
cp apps/dex-cache/.env.example apps/dex-cache/.env.local
# ...repeat for other apps/services
```

### Development

```bash
# Start all development servers
pnpm dev

# Or start specific applications/services
pnpm dev --filter=apps/simple-swap
pnpm dev --filter=services/party-service
```

### Monorepo Commands

```bash
pnpm dev                    # Start all applications/services
pnpm build                  # Build all packages, modules, services, and apps
pnpm test                   # Run all tests
pnpm lint                   # Lint all packages
pnpm clean                  # Clean all build artifacts

# Add dependency to a specific workspace
pnpm add <pkg> --filter=modules/business-logic
```

---

## Architecture

### Directory Roles

- **apps/**: User-facing applications (web, CLI, etc.)
- **modules/**: Internal, reusable logic (business logic, adapters, types)
- **services/**: Deployable backend services (APIs, workers)
- **packages/**: Public, versioned packages for external use

### Inter-App/Service Communication

- Prefer direct imports from `modules/` for internal logic sharing (type-safe, no HTTP overhead)
- Use HTTP/WebSocket APIs only for cross-service boundaries or external integrations
- Shared types/interfaces live in `modules/shared-types`

### Example Data Flow

#### Price Data Pipeline
1. **services/dex-cache**: Fetches and processes market data
2. **Vercel KV**: Caches processed price information
3. **services/party-service**: Broadcasts real-time updates
4. **apps/simple-swap**: Consumes data for trading interface

#### Token Information
1. **services/token-cache**: Maintains metadata cache
2. **services/metadata**: Enriches token information
3. **modules/shared-types**: Provides typed interfaces
4. **All Apps/Services**: Consume consistent token data

---

## Development Workflow

### Working with Multiple Apps/Services

```bash
# Terminal 1: Start shared services
pnpm dev --filter=services/token-cache --filter=services/party-service

# Terminal 2: Start main applications  
pnpm dev --filter=apps/simple-swap --filter=apps/dex-cache
```

### Testing Changes

```bash
pnpm test --filter=apps/simple-swap
pnpm test --filter=modules/business-logic
```

### Building for Production

```bash
pnpm build --filter=packages/*
pnpm build --filter=apps/simple-swap
```

### Code Organization

- **Shared logic**: Place in `modules/`
- **App-specific code**: Keep within `apps/`
- **Deployable services**: In `services/`
- **Public packages**: In `packages/`
- **API integrations**: Centralize in `modules/` or `packages/` as appropriate

### Creating New Modules/Services

```bash
# Create a new module
pnpm create-module <module-name>

# Create a new service
pnpm create-service <service-name>
```

*(Add scripts or templates as needed for consistency)*

---

## API Documentation

### Internal APIs
- **Token Cache API**: `/api/v1/tokens/*` - Token metadata and validation
- **Price API**: `/api/v1/prices/*` - Real-time and historical pricing
- **Order API**: `/api/v1/orders/*` - Order management and execution

### External Integrations
- **Stacks API**: Blockchain data and transaction broadcasting
- **PartyKit**: Real-time WebSocket connections
- **Vercel Storage**: KV and Blob storage operations

---

## Deployment

### Application/Service Deployment

Each application and service deploys independently to Vercel or your chosen platform:

```bash
cd apps/simple-swap
vercel deploy

cd services/party-service
vercel deploy
```

### Shared Dependencies

- Packages, modules, and services are built automatically during deployment
- Turborepo handles build optimization and caching
- Dependencies are resolved across the entire monorepo

### Environment Management

- Production variables configured in Vercel dashboard
- Staging environments use separate KV and Blob instances
- PartyKit environments isolated per deployment

---

## Testing

### Test Strategy

- **Unit Tests**: Individual component and utility testing
- **Integration Tests**: Cross-module/service functionality
- **E2E Tests**: Full application workflows
- **API Tests**: Backend service validation

### Running Tests

```bash
pnpm test
pnpm test --filter=apps/simple-swap
pnpm test --filter=modules/business-logic
pnpm test:watch --filter=apps/simple-swap
```

---

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

---

## Documentation

- **Application READMEs**: Each app/service/module has specific setup instructions
- **API Documentation**: Available in `/docs` application
- **Component Library**: Documented in `packages/ui`
- **Technical Guides**: Located in `/docs` for complex integrations

---

## Troubleshooting

### Common Issues

- **Build Errors**: Run `pnpm clean` then `pnpm install`
- **Type Errors**: Ensure shared modules/packages are built first
- **Environment Variables**: Check all required variables are set
- **Port Conflicts**: Applications/services use different ports by default

### Debug Mode

Set `DEBUG=true` in environment variables for detailed logging across all applications and services.

---

Built by the Charisma team for the Stacks ecosystem.