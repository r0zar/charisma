---
sidebar_position: 1
title: Overview
---

# Real-time System Overview

The Charisma real-time system provides live price and balance data streaming for the entire ecosystem through a WebSocket-based infrastructure built on PartyKit.

## Mission

Deliver real-time cryptocurrency price and user balance data across all Charisma applications with:
- **Low latency** - Sub-second update propagation
- **High efficiency** - Minimal bandwidth and server resources
- **Scalability** - Handles thousands of concurrent connections
- **Reliability** - Automatic reconnection and error recovery

## Architecture

The real-time system follows a three-tier architecture:

### **Tier 1: External Data Sources**
- **Hiro API** - Provides user balance data from the Stacks blockchain
- **Token Metadata API** - Supplies token information, pricing, and market data
- **Subnet Contracts** - L2 smart contracts for subnet token balances

### **Tier 2: PartyKit Infrastructure** 
- **PricesParty** - WebSocket server streaming token price updates
- **BalancesParty** - WebSocket server streaming user balance data
- **Edge Deployment** - Serverless scaling across global edge locations

### **Tier 3: Client Layer**
- **BlazeProvider** - React Context managing WebSocket connections and state
- **usePartySocket** - React hooks for WebSocket communication
- **Shared State** - Centralized data store across all components

### **Data Flow**
```
External APIs → PartyKit Servers → BlazeProvider → React Applications
     ↓               ↓                ↓              ↓
[Hiro API]     [PricesParty]   [React Context]  [simple-swap]
[Metadata API] [BalancesParty] [usePartySocket] [dex-cache]
[Subnet APIs]                                   [blaze-signer]
                                                [meme-roulette]
```

## Core Components

### 1. WebSocket Servers (@apps/charisma-party)
- **PricesParty** - Streams token price updates with 5-minute intervals
- **BalancesParty** - Streams user balance data including subnet token support
- Built on PartyKit for horizontal scaling and edge deployment

### 2. Client Provider (BlazeProvider)
- React Context provider for WebSocket state management
- Automatic connection handling and reconnection
- Shared state across all components in an application

### 3. Data Processing Pipeline
- Fetches data from multiple external APIs
- Enriches metadata with pricing information
- Handles subnet token balance aggregation
- Broadcasts updates to all connected clients

## Key Features

### Real-time Updates
- Price changes propagated within seconds
- Balance updates after transactions
- Connection status monitoring

### Subnet Token Support
- Detects L2 subnet tokens automatically
- **Separate messages** for mainnet and subnet balance data
- **Client-side merging** using token utilities for flexible presentation
- Maps subnet tokens to their mainnet equivalents using base contract IDs

### Development Features
- Price noise generation for testing
- Environment detection (dev/test/production)
- Comprehensive logging and debugging

### Scalability
- Edge deployment via PartyKit
- Efficient subscription management
- Automatic client cleanup

## Benefits

1. **Performance** - Real-time updates without polling
2. **Efficiency** - Shared connections reduce API calls
3. **Developer Experience** - Simple React hooks interface
4. **Reliability** - Built-in error handling and recovery
5. **Scalability** - Serverless edge deployment

## Use Cases

- **Trading Interfaces** - Live price feeds for DEX applications
- **Portfolio Dashboards** - Real-time balance tracking
- **Analytics** - Live market data visualization
- **Gaming** - Token balance verification for games
- **DeFi Protocols** - Real-time liquidity and pricing data

## Getting Started

For client integration, see [Client Integration](./client-integration.md).

For server deployment, see [Deployment](./deployment.md).

For detailed message protocols, see [WebSocket Servers](./websocket-servers.md).