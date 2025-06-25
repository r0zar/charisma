# Simple Swap

A Next.js application for token swapping with limit orders, DCA strategies, and advanced trading features.

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (recommended package manager)

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run type checking
pnpm check-types

# Run linting
pnpm lint
```

## Architecture

### Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context + Custom Hooks
- **Database**: Vercel KV (key-value) + Vercel Blob (file storage)
- **Real-time**: PartyKit for live updates
- **Deployment**: Vercel

### Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # Backend API endpoints
│   ├── swap/              # Main swap interface
│   ├── orders/            # Order management UI
│   └── admin/             # Admin panels
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── swap-interface/   # Swap-related components
│   ├── orders/           # Order management components
│   └── admin/            # Admin-specific components
├── contexts/             # React Context providers
├── hooks/                # Custom React hooks
├── lib/                  # Core business logic
│   ├── orders/           # Order management
│   ├── price/            # Price data handling
│   ├── margin/           # Margin trading
│   └── api-keys/         # API key management
└── types/                # TypeScript type definitions
```

### Key Features

#### Order Management
- **Limit Orders**: Price-triggered order execution
- **DCA Strategies**: Dollar cost averaging with time-based execution
- **Split Orders**: Large orders split into smaller chunks
- **Manual Execution**: API-triggered order execution

#### Trading Interfaces
- **Simple Swap**: Basic token swapping interface
- **Pro Mode**: Advanced trading with charts and multiple order types
- **Order History**: Comprehensive order tracking and management

#### Admin Features
- **Price Monitoring**: Real-time price feeds and diagnostics
- **Order Processing**: Background order execution system
- **Analytics**: Trading statistics and system metrics

## API Routes

### Public APIs
- `GET /api/v1/orders` - List user orders
- `POST /api/v1/orders/new` - Create new order
- `POST /api/v1/orders/[uuid]/execute` - Execute order
- `DELETE /api/v1/orders/[uuid]/cancel` - Cancel order

### Admin APIs
- `GET /api/admin/prices` - Price data management
- `GET /api/admin/transaction-stats` - System statistics
- `POST /api/admin/force-price-update` - Manual price updates

## Environment Variables

```bash
# Required
KV_REST_API_URL=       # Vercel KV REST API URL
KV_REST_API_TOKEN=     # Vercel KV REST API token
BLOB_READ_WRITE_TOKEN= # Vercel Blob read/write token
PARTYKIT_HOST=         # PartyKit host URL
NEXT_PUBLIC_API_URL=   # Public API endpoint
API_SECRET_KEY=        # Internal API authentication

# Optional
PRICE_UPDATE_INTERVAL= # Price update frequency (default: 30s)
ORDER_BATCH_SIZE=      # Order processing batch size
DEBUG_MODE=           # Enable debug logging
```

## Development

### Code Style
- ESLint + Prettier for code formatting
- TypeScript strict mode enabled
- Functional components with hooks preferred
- Modular architecture with clear separation of concerns

### Testing
```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test -- path/to/test.test.ts
```

### Data Storage

#### Vercel KV (Key-Value Store)
Used for structured data with Redis-compatible API:
- **Orders**: Indexed by UUID and owner address
- **Price Data**: Real-time and historical price feeds
- **User Sessions**: Authentication and preferences
- **API Keys**: Rate limiting and usage tracking

```typescript
// Example KV operations
await kv.set(`order:${uuid}`, orderData);
await kv.get(`prices:${tokenId}`);
await kv.zadd(`user_orders:${address}`, timestamp, uuid);
```

#### Vercel Blob (File Storage)
Used for large files and assets:
- **Chart Data**: Historical price charts and market data
- **Transaction Logs**: Detailed execution history
- **User Uploads**: Profile images and documents

```typescript
// Example Blob operations
await put('charts/token_data.json', chartData, { access: 'public' });
const file = await head('logs/transactions_2024.json');
```

#### Order Schema
```typescript
interface LimitOrder {
  uuid: string;
  owner: string;
  inputToken: string;
  outputToken: string;
  amountIn: string;
  targetPrice?: string;
  direction?: 'lt' | 'gt';
  conditionToken?: string;
  status: 'open' | 'broadcasted' | 'confirmed' | 'failed' | 'cancelled';
  createdAt: string;
  strategyId?: string;
  strategyType?: 'dca' | 'split' | 'batch';
  // ... additional fields
}
```

### Performance Considerations

- **Price Updates**: Cached in Vercel KV with 30-second intervals
- **Order Processing**: Batched execution to reduce API calls
- **Real-time Updates**: PartyKit WebSocket connections for live order status
- **KV Optimization**: Strategic key naming and TTL for efficient lookups
- **Blob Storage**: CDN-cached for fast asset delivery

## Deployment

### Vercel Deployment
1. Connect repository to Vercel
2. Configure environment variables
3. Deploy automatically on push to main

### Manual Deployment
```bash
# Build application
pnpm build

# Start production server
pnpm start
```

## Contributing

1. Follow TypeScript strict typing
2. Use existing component patterns
3. Add tests for new features
4. Update documentation for API changes

## Troubleshooting

### Common Issues

**Build Errors**: Run `pnpm check-types` to identify TypeScript issues
**KV Connection**: Verify `KV_REST_API_URL` and `KV_REST_API_TOKEN` are set
**Blob Storage**: Check `BLOB_READ_WRITE_TOKEN` permissions
**Real-time Updates**: Ensure `PARTYKIT_HOST` is accessible
**Order Execution**: Verify wallet connections and gas fees

### Debug Mode
Set `DEBUG_MODE=true` in environment variables for detailed logging.

## Script Runner

This project includes an elegant script runner system for debugging, testing, and data analysis:

```bash
# List available scripts
pnpm script list

# Run a specific script
pnpm script <script-name> [args...]

# Examples
pnpm script test-order-api
pnpm script analyze-order-data
pnpm script test-order-api SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.brc20-ormm SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token 1000000
```

### Script Capabilities

The script runner provides:

- **TypeScript Support**: Run `.ts` files directly with automatic compilation
- **Environment Variables**: Automatic loading from `.env` files with priority order
- **Auto-discovery**: Scripts are automatically detected in the `scripts/` folder
- **Argument Passing**: Pass command-line arguments to your scripts
- **Project Context**: Full access to project dependencies and utilities

### Use Cases

1. **Debugging Trading Issues**
   - Test order API endpoints with real data
   - Analyze failed orders and error patterns
   - Validate price calculations and slippage
   - Debug routing algorithms

2. **Data Analysis & Insights**
   - Analyze trading patterns and volumes
   - Generate reports on order completion rates
   - Track popular token pairs and routes
   - Monitor system performance metrics

3. **Migrations & Backfills**
   - Migrate order data between formats
   - Backfill missing historical data
   - Update cached price information
   - Batch process pending orders

4. **Testing & Validation**
   - End-to-end API testing
   - Load testing with synthetic data
   - Integration testing with external DEXs
   - Validation of order execution logic

### Creating New Scripts

To create a new script:

1. Add a `.ts` file to the `scripts/` directory
2. Write your script using project imports and environment variables
3. Run with `pnpm script <your-script-name>`

No need to modify `package.json` - scripts are auto-discovered!