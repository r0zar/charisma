---
slug: overview
sidebar_position: 1
title: Introduction to Charisma Pricing System
---

# Charisma Pricing System: Multi-Path Discovery with sBTC Anchoring

**The Charisma Pricing System provides real-time, manipulation-resistant token prices through sophisticated multi-path discovery algorithms anchored to Bitcoin's market value via sBTC. This system powers accurate pricing across the Charisma ecosystem while maintaining reliability and transparency.**

The pricing infrastructure analyzes multiple trading routes through liquidity pools, calculates confidence scores for each path, and provides comprehensive pricing data that developers can trust for their applications. By leveraging sBTC as a price anchor and implementing decimal-aware calculations, the system delivers institutional-grade pricing accuracy.

## Key Features

### Multi-Path Price Discovery
- **Route Analysis**: Examines all possible trading paths between tokens and sBTC
- **Path Weighting**: Prioritizes routes based on liquidity depth and reliability
- **Alternative Paths**: Provides backup pricing routes for redundancy
- **Confidence Scoring**: Quantifies reliability of each price calculation

### sBTC Price Anchoring
- **Bitcoin Integration**: Uses sBTC as the primary price reference point
- **Real-time Updates**: Fetches current BTC prices from multiple oracle sources
- **Fallback Mechanisms**: Maintains pricing stability during oracle outages
- **Stablecoin Support**: Special handling for USD-pegged tokens

### Specialized Token Handling
- **Stablecoin Pricing**: Fixed $1.00 pricing for optimal trading experience
- **Decimal-Aware Math**: Proper conversion between atomic units and decimal values
- **Exchange Rate Accuracy**: Ensures correct price ratios between tokens (fixed 100x inflation bug)
- **Precision Maintenance**: Maintains calculation accuracy across token scales
- **Atomic Reserve Handling**: Converts reserves to decimal values before exchange rate calculations

### Liquidity Analysis
- **Pool Distribution**: Analyzes liquidity spread across trading pairs
- **Risk Assessment**: Evaluates concentration and diversification risks
- **Market Cap Calculations**: Derives accurate market capitalizations
- **Reserve Tracking**: Monitors real-time pool reserve levels

## Core Components

### Price Graph
The system constructs a graph of all available tokens and their trading relationships:
- **Nodes**: Represent individual tokens with metadata
- **Edges**: Represent trading pairs with liquidity information
- **Pathfinding**: Algorithms to discover optimal trading routes
- **Liquidity Weighting**: Routes prioritized by available liquidity

### Calculation Engine
Advanced algorithms process pricing data with recent improvements:
- **Decimal-Aware Exchange Rates**: Proper atomic-to-decimal conversion before calculations
- **Outlier Filtering**: Removes prices >50% from median for accuracy
- **Weighted Path Aggregation**: Combines multiple routes using liquidity-based weights
- **Confidence Metrics**: Statistical reliability measures with consistency scoring
- **Alternative Analysis**: Backup route evaluation with theoretical pricing
- **Stablecoin Pool Handling**: Skips constant product for stablecoin/stablecoin pairs

### Cache System
Performance optimization through intelligent caching:
- **Reserve Caching**: Stores pool data with configurable TTL
- **Price Caching**: Maintains recent calculations for quick access
- **BTC Oracle Cache**: Buffers external price feeds
- **Stale-While-Revalidate**: Serves cached data while updating

## Use Cases

### DeFi Applications
- **Trading Interfaces**: Real-time price feeds for swap interfaces
- **Portfolio Tracking**: Accurate asset valuation
- **Arbitrage Detection**: Multi-path price comparison
- **Risk Management**: Liquidity and concentration analysis

### Analytics Platforms
- **Market Data**: Comprehensive token pricing information
- **Historical Analysis**: Price trend tracking capabilities
- **Liquidity Metrics**: Pool performance evaluation
- **Confidence Tracking**: Price reliability assessment

### Developer Integration
- **REST API**: Simple HTTP endpoints for price data
- **Real-time Updates**: WebSocket connections for live prices
- **Batch Processing**: Efficient bulk price calculations
- **Filtering Options**: Customizable data queries

## Getting Started

The pricing system is accessible through RESTful APIs and provides comprehensive documentation for integration. Developers can access real-time prices, historical data, and detailed calculation information through simple HTTP requests.

Key endpoints include:
- [`/api/v1/prices`](https://invest.charisma.rocks/api/v1/prices) - Bulk token pricing with filtering
- `/api/v1/prices/[tokenId]` - Individual token price details
- Token detail pages with liquidity analysis

For detailed API documentation, see [API Reference](api-reference.md).

## Architecture Overview

The system operates on several layers:
1. **Data Layer**: Pool reserves and token metadata
2. **Graph Layer**: Trading relationship modeling
3. **Calculation Layer**: Multi-path price discovery
4. **API Layer**: RESTful interface for consumers
5. **UI Layer**: Web interfaces for visualization

Each layer is designed for reliability, performance, and accuracy, ensuring that pricing data meets the demands of production DeFi applications.

## Next Steps

Explore the detailed documentation to understand how to integrate and use the Charisma Pricing System:

- [Architecture Details](architecture.md) - Technical system design
- [API Reference](api-reference.md) - Endpoint documentation
- [Price Discovery](price-discovery.md) - Algorithm explanations
- [Stablecoin Pricing](stablecoin-pricing.md) - Fixed $1 pricing strategy
- [Troubleshooting](troubleshooting.md) - Common issues and solutions

The Charisma Pricing System provides the foundation for accurate, reliable token pricing across the Stacks ecosystem.