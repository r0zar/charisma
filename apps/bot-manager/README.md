# Bot Manager

DeFi Bot Management Application - A comprehensive web interface for managing automated trading bots on the Stacks blockchain.

## Getting Started

First, run the development server:

```bash
pnpm dev --filter=bot-manager
```

Open [http://localhost:3420](http://localhost:3420) with your browser to see the result.

## Features

- **Bot Management** - Create, configure, and monitor DeFi trading bots
- **Yield Farming** - Automated liquidity pool farming strategies
- **Portfolio Tracking** - Real-time balance and performance monitoring
- **Activity History** - Transaction logging and status tracking
- **Mobile Responsive** - Works on all devices
- **Real-time Updates** - Live balance and status updates
- **Secure Wallet Management** - Encrypted bot wallet generation
- **Analytics Dashboard** - Performance metrics and insights
- **Configurable Data Loading** - Support for incremental migration from static to API-backed data

## Data Loading System

The application supports configurable data loading with incremental migration capabilities:

### Configuration Phases

- **Development**: All static data for fast iteration
- **Phase 1**: API notifications with static fallback
- **Phase 2**: API market + notifications with static fallback
- **Phase 3**: API user + market + notifications with static fallback
- **Phase 4**: API bots + user + market + notifications with static fallback
- **Production**: All API with static fallback

### Environment Setup

Copy `.env.local.example` to `.env.local` and configure:

```bash
# Set the data loading phase
NEXT_PUBLIC_DATA_PHASE=development

# Enable debug logging
NEXT_PUBLIC_DEBUG_DATA_LOADING=true
```

### API Endpoints

- `GET /api/v1/metadata` - Application metadata
- `GET /api/v1/user` - User settings and preferences
- `GET /api/v1/bots` - Bot data with filtering and pagination
- `GET /api/v1/market` - Market data with sorting
- `GET /api/v1/notifications` - Notifications with filtering

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm test` - Run tests
- `pnpm lint` - Run linting
- `pnpm check-types` - Type check

## Learn More

To learn more about the technologies used:

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Turborepo](https://turbo.build/repo)