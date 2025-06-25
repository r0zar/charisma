# DEX Cache

A high-performance caching layer and analytics platform for decentralized exchange data on Stacks, providing real-time price feeds, pool analytics, and liquidity insights.

## Features

- **Price Discovery**: Multi-DEX price aggregation with intelligent caching
- **Pool Analytics**: Deep liquidity analysis and APY calculations
- **Energy System**: Hold-to-earn mechanics with rate analytics
- **Vault Management**: Liquidity pool creation and management tools
- **Real-time Data**: Live price feeds with sub-second latency
- **Admin Dashboard**: System monitoring and energy rate management

## Development

```bash
# Install dependencies
pnpm install

# Start development server (runs on port 3003)
pnpm dev

# Build for production
pnpm build

# Run linting
pnpm lint

# Type checking
pnpm check-types
```

## Architecture

### Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript with strict typing
- **Styling**: Tailwind CSS
- **Cache**: Vercel KV for high-performance data storage
- **Analytics**: Custom energy rate calculation engine
- **Monitoring**: Sentry for error tracking and performance monitoring

### Key Components

#### Pricing Engine
- Multi-source price aggregation from ALEX, Arkadiko, and other DEXs
- Intelligent cache invalidation with TTL optimization
- BTC oracle integration for accurate USD pricing
- Price path visualization and impact analysis

#### Pool Management
- Automated pool discovery and metadata extraction
- Liquidity depth analysis and concentration metrics
- APY calculations with compound interest modeling
- Pool health monitoring and risk assessment

#### Energy System
- Dynamic energy generation rate calculations
- Multi-contract energy source aggregation
- Real-time balance tracking and distribution
- Administrative controls for rate adjustments

## Script Runner

This project includes an elegant script runner system for debugging, testing, and data analysis:

```bash
# List available scripts
pnpm script list

# Run a specific script
pnpm script <script-name> [args...]

# Examples
pnpm script analyze-pool-data
pnpm script test-price-feeds
pnpm script debug-cache-performance
pnpm script test-price-feeds SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.brc20-ormm SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token 1000000
```

### Script Capabilities

The script runner provides:

- **TypeScript Support**: Run `.ts` files directly with automatic compilation
- **Environment Variables**: Automatic loading from `.env` files with priority order
- **Auto-discovery**: Scripts are automatically detected in the `scripts/` folder
- **Argument Passing**: Pass command-line arguments to your scripts
- **Project Context**: Full access to project dependencies and utilities

### Use Cases

1. **Pool Analysis & Optimization**
   - Analyze TVL distribution across pools
   - Monitor liquidity concentration and efficiency
   - Track yield farming opportunities
   - Identify arbitrage possibilities

2. **Price Feed Debugging**
   - Validate price accuracy across sources
   - Monitor cache hit/miss ratios
   - Test failover mechanisms
   - Analyze latency and performance

3. **Cache Performance Monitoring**
   - Debug cache key strategies
   - Optimize TTL values
   - Monitor memory usage patterns
   - Identify bottlenecks and hotspots

4. **Data Migration & Backfills**
   - Migrate pool metadata formats
   - Backfill historical price data
   - Update energy rate configurations
   - Batch process pending calculations

### Creating New Scripts

To create a new script:

1. Add a `.ts` file to the `scripts/` directory
2. Write your script using project imports and environment variables
3. Run with `pnpm script <your-script-name>`

No need to modify `package.json` - scripts are auto-discovered!

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Vercel KV (required for caching)
KV_URL=your_kv_url_here
KV_REST_API_URL=your_kv_rest_api_url_here
KV_REST_API_TOKEN=your_kv_rest_api_token_here

# API Keys
HIRO_API_KEY=your_hiro_api_key_here
ALEX_API_KEY=your_alex_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Monitoring
SENTRY_DSN=your_sentry_dsn_here
VERCEL_ANALYTICS_ID=your_analytics_id_here

# Development
NODE_ENV=development
```

## API Routes

### Price APIs
- `GET /api/prices` - Current token prices
- `GET /api/prices/[token]` - Specific token price data
- `GET /api/prices/history/[token]` - Historical price data

### Pool APIs
- `GET /api/pools` - List all pools with metadata
- `GET /api/pools/[id]` - Specific pool details
- `POST /api/pools/new` - Create new pool entry

### Energy APIs
- `GET /api/energy/rates` - Current energy generation rates
- `GET /api/energy/analytics` - Energy system analytics
- `POST /api/admin/energy/rates` - Update energy rates (admin)

## Deployment

### Vercel Deployment
1. Connect repository to Vercel
2. Configure environment variables
3. Deploy automatically on push to main

### Performance Optimization
- Vercel KV caching with strategic TTL values
- Edge functions for low-latency price feeds
- CDN optimization for static assets
- Database query optimization with indexes

## Contributing

1. Follow TypeScript strict typing conventions
2. Use existing component patterns and utility functions
3. Add comprehensive error handling and logging
4. Update documentation for API changes
5. Test cache invalidation scenarios

## Troubleshooting

### Common Issues

**Cache Misses**: Check KV connection and TTL configuration
**Price Discrepancies**: Verify API keys and source availability
**Energy Calculation Errors**: Review contract interfaces and rate parameters
**Performance Issues**: Monitor cache hit ratios and optimize key strategies

### Debug Mode
Enable detailed logging by setting appropriate environment variables and using the script runner for deep analysis.