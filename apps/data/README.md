# Blockchain Data Warehouse

A Next.js application for managing blockchain data with Vercel Blob storage, featuring a two-pane dashboard with tree navigation and Monaco editor.

## Features

- **Blockchain-native API patterns** with Stacks address validation
- **Catch-all routing** for flexible API endpoints
- **Vercel Blob storage** integration with streaming support
- **Two-pane dashboard** with tree navigator and Monaco editor
- **Progressive loading** for large datasets
- **Auto-save** functionality with syntax highlighting

## API Endpoints

### Addresses
- `GET /api/v1/addresses/<stacks-address>/balances` - STX and SIP-10 token balances
- `GET /api/v1/addresses/<stacks-address>/transactions` - Transaction history

### Contracts
- `GET /api/v1/contracts/<contract-address>/<function-name>` - Smart contract data
- `GET /api/v1/contracts/<contract-address>/metadata` - Contract metadata

### Prices
- `GET /api/v1/prices/<token-pair>/current` - Current price data
- `GET /api/v1/prices/<token-pair>/history` - Historical price data

### Streaming Support
Add query parameters for large datasets:
- `?stream=true` - Enable streaming mode
- `?offset=0&limit=1000` - Pagination controls

## Getting Started

```bash
# Install dependencies
pnpm install

# Interactive environment setup (recommended)
pnpm setup

# OR manually set up environment
cp .env.example .env.local
# Edit .env.local and add your BLOB_READ_WRITE_TOKEN

# Seed sample data (optional)
pnpm seed

# Start development server
pnpm dev
```

Open [http://localhost:3800](http://localhost:3800) with your browser to see the dashboard.

## Environment Variables

```env
# Required: Vercel Blob token for write operations
BLOB_READ_WRITE_TOKEN=your_blob_token_here

# Optional: Deployment ID for cache segmentation  
VERCEL_DEPLOYMENT_ID=your_deployment_id

# Optional: Custom blob storage URL
BLOB_BASE_URL=https://your-custom-domain.com/
```

## Architecture Overview

### Single Root Blob Design
The system uses a **single root blob** (`v1/root.json`) as the source of truth, providing:
- **Atomic consistency** for all data operations
- **Optimal CDN caching** across Vercel's 119 PoPs in 94 cities  
- **Sub-100ms response times** globally through strategic edge caching
- **Direct CDN access** for read operations with public blob access

### Vercel Edge Network Optimization
Leverages Vercel's infrastructure with **differentiated cache policies**:

- **Prices**: `s-maxage=300, stale-while-revalidate=1800` (5min cache, 30min stale)
- **Balances**: `s-maxage=900, stale-while-revalidate=3600` (15min cache, 1hr stale)  
- **Contracts**: `s-maxage=1800, stale-while-revalidate=7200` (30min cache, 2hr stale)
- **Transactions**: `s-maxage=3600, stale-while-revalidate=86400` (1hr cache, 24hr stale)
- **Streaming**: No caching for real-time data

### Data Structure

All data is stored in a single hierarchical root blob:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2024-01-01T00:00:00.000Z",
  "addresses": {
    "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9": {
      "balances": { "stx": {...}, "fungible_tokens": [...] },
      "transactions": { "results": [...] }
    }
  },
  "contracts": {
    "SP3K8BC0PFEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token": {
      "metadata": {...},
      "get-balance": {...}
    }
  },
  "prices": {
    "STX-USDA": {
      "current": {...},
      "history": {...}
    }
  }
}
```

## Usage

1. **Navigation**: Use the left pane tree navigator to browse blockchain data
2. **Editing**: Select any JSON file to edit in the Monaco editor
3. **Validation**: Real-time JSON validation with error highlighting
4. **Saving**: Auto-save functionality with change tracking
5. **Streaming**: Large datasets are loaded progressively

## Stacks Address Validation

- **Mainnet**: `SP` or `SM` prefix + 28 base58 characters
- **Testnet**: `ST` prefix + 28 base58 characters
- **Contracts**: Address + `.contract-name` format