# Contract Registry Dashboard

A Next.js dashboard for monitoring stats and metrics from the `@services/contract-registry` service.

## Overview

This application provides a comprehensive dashboard displaying:

- **Registry Statistics**: Total contracts, contract types, validation status
- **Storage Metrics**: Blob storage usage, compression ratios, cache performance  
- **Discovery Analytics**: Contract discovery methods, trait distribution, success rates
- **Health Monitoring**: Service status, API response times, error rates

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server (port 3500)
pnpm dev --filter=contract-registry
```

Open [http://localhost:3500](http://localhost:3500) with your browser to see the dashboard.

## Features

- 📊 Real-time stats dashboard
- 🎨 Beautiful UI with shadcn/ui components
- 📱 Responsive design
- 🌙 Dark/light theme support
- ⚡ Fast loading with Suspense
- 🔄 Auto-refresh capabilities

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **UI**: shadcn/ui + TailwindCSS
- **Data**: @services/contract-registry integration
- **Theme**: next-themes
- **Icons**: Lucide React

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm test` - Run tests
- `pnpm lint` - Run linting
- `pnpm check-types` - Type check

## API Integration

The app integrates with the contract registry service through:

- `/api/stats` - Main stats endpoint
- `/lib/contract-registry.ts` - Client wrapper
- Real-time data with fallback to mock data

## Project Structure

```
src/
├── app/
│   ├── api/stats/route.ts    # Stats API endpoint
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Dashboard page
├── lib/
│   └── contract-registry.ts  # Service integration
└── components/
    └── ui/                   # shadcn/ui components
```

## Stats Categories

### Registry Overview
- Total contracts count
- Contract type distribution (Token, NFT, Vault, Unknown)
- Validation status breakdown
- Recent activity metrics

### Storage Metrics  
- Blob storage usage and capacity
- Average contract size after compression
- Largest contract identification
- Cache hit rates and performance

### Discovery Analytics
- Discovery method effectiveness
- Trait implementation distribution
- Success rates and timing metrics
- Standards compliance tracking

### Health Monitoring
- Service health status
- API response performance
- Error rate tracking
- System availability metrics

## Environment Variables

No additional environment variables required - the app uses workspace dependencies for service integration.