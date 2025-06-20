# Charisma: Next Generation DeFi Platform

A comprehensive DeFi ecosystem built on Stacks with advanced trading features, sophisticated glass morphism design, and professional-grade tools for token swapping and portfolio management.

## 🚀 Overview

Charisma is a modern decentralized exchange (DEX) platform that provides:

- **Advanced Token Swapping** with optimal routing across liquidity pools
- **Professional Trading Tools** including limit orders, DCA, and strategy management
- **Glass Morphism Design System** inspired by Apple and Tesla aesthetics
- **Real-time Analytics** and comprehensive token exploration
- **Security-First Architecture** with isolated vault contracts

## 📁 Project Structure

This monorepo contains multiple applications and shared packages:

### Applications

- **`simple-swap`**: Main DEX interface with glass morphism design
  - Next.js 15 with App Router
  - Advanced order types (limit orders, DCA, sandwich trades)
  - Real-time price charts and analytics
  - Professional responsive design system
  - Comprehensive admin panel

### Shared Packages

- **`@repo/tokens`**: Token metadata and caching system
- **`@repo/eslint-config`**: Shared ESLint configurations
- **`@repo/typescript-config`**: TypeScript configurations across packages
- **`@repo/ui`**: Shared UI components library

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS with custom glass morphism design system
- **UI Components**: shadcn/ui with custom enhancements
- **Charts**: Lightweight Charts for real-time price visualization
- **Icons**: Lucide React
- **State Management**: React Context with optimized performance

### Backend & Integration
- **Blockchain**: Stacks blockchain integration
- **SDK**: Blaze SDK for real-time data and transactions
- **Database**: PostgreSQL for analytics and caching
- **Real-time**: WebSocket connections for live price updates

### Development Tools
- **Monorepo**: Turborepo for optimized builds and caching
- **Package Manager**: pnpm for efficient dependency management
- **Type Safety**: TypeScript with strict configurations
- **Code Quality**: ESLint, Prettier, and comprehensive testing
- **Performance**: Advanced caching and optimization strategies

## 🎨 Design System

### Glass Morphism Implementation
- **Philosophy**: Seamless interaction principles with invisible-until-hover patterns
- **Visual Hierarchy**: Single-layer depth with consistent elevation
- **Opacity Hierarchy**: Structured from 0.02 (base) to 0.12 (active borders)
- **Color System**: Comprehensive text hierarchy and status colors
- **Responsive Design**: Mobile-first with custom breakpoints

### Key Design Principles
- **Premium Aesthetic**: Inspired by Apple and Tesla design languages
- **Progressive Disclosure**: Information architecture that reveals complexity gradually
- **Smooth Transitions**: All interactions use consistent 200ms timing
- **Accessibility**: Proper focus states and screen reader support

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended package manager)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd charisma
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp apps/simple-swap/.env.example apps/simple-swap/.env.local
   # Configure your environment variables
   ```

4. **Development**
   ```bash
   # Start all development servers
   pnpm dev
   
   # Or start specific app
   cd apps/simple-swap
   pnpm dev
   ```

### Available Commands

#### Global Commands
```bash
pnpm build        # Build all packages and applications
pnpm dev          # Start all development servers
pnpm lint         # Run linting across all packages
pnpm test         # Run all tests
pnpm clean        # Clean all build artifacts
```

#### Application-Specific Commands
```bash
# Within apps/simple-swap
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run linting
pnpm check-types  # TypeScript type checking
pnpm test         # Run tests with coverage
```

## 🏗️ Architecture

### Simple Swap Application

#### Core Features
- **Token Swapping**: Multi-hop routing with up to 9-hop paths
- **Limit Orders**: Advanced order types with condition-based execution
- **DCA Strategies**: Automated dollar-cost averaging with flexible scheduling
- **Sandwich Trading**: Sophisticated arbitrage strategies
- **Real-time Analytics**: Live price charts and portfolio tracking

#### Key Components
- **Swap Interface**: Main trading interface with responsive design
- **Order Management**: Professional order book and strategy tracking
- **Token Explorer**: Comprehensive token information and analytics
- **Pro Mode**: Advanced features for sophisticated traders
- **Admin Panel**: Complete system monitoring and management

#### Security Features
- **Isolated Vaults**: Each pool uses separate Clarity contracts
- **Non-custodial**: Users maintain control of their private keys
- **Transaction Monitoring**: Real-time transaction status tracking
- **Error Handling**: Comprehensive error recovery and user feedback

## 📊 Features

### Trading Features
- ✅ **Instant Swaps** with optimal routing
- ✅ **Limit Orders** with flexible conditions
- ✅ **DCA Strategies** with customizable intervals
- ✅ **Sandwich Trading** for advanced users
- ✅ **Real-time Price Charts** with technical analysis
- ✅ **Portfolio Tracking** and performance analytics

### User Experience
- ✅ **Glass Morphism Design** with premium aesthetics
- ✅ **Responsive Interface** optimized for all devices
- ✅ **Progressive Web App** capabilities
- ✅ **Dark Mode** with sophisticated visual hierarchy
- ✅ **Accessibility** with keyboard navigation and screen readers

### Technical Features
- ✅ **TypeScript** with strict type safety
- ✅ **Real-time Updates** via WebSocket connections
- ✅ **Advanced Caching** for optimal performance
- ✅ **Error Boundaries** with graceful degradation
- ✅ **Performance Monitoring** and analytics

## 🔧 Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://...

# Stacks Network
NEXT_PUBLIC_STACKS_API_URL=https://api.mainnet.hiro.so
NEXT_PUBLIC_NETWORK=mainnet

# Application
NEXT_PUBLIC_APP_URL=https://swap.charisma.rocks
NEXTAUTH_SECRET=your-secret-key
```

### Turborepo Configuration
The project uses Turborepo for optimized builds and caching. Key configuration includes:
- **Pipeline**: Optimized build and development workflows
- **Remote Caching**: Shared cache for faster CI/CD
- **Dependency Management**: Automatic dependency tracking

## 🚀 Deployment

### Production Build
```bash
# Build all applications
pnpm build

# Deploy simple-swap
cd apps/simple-swap
pnpm build
pnpm start
```

### Docker Support
```bash
# Build Docker image
docker build -t charisma-swap .

# Run container
docker run -p 3000:3000 charisma-swap
```

## 📝 Development Guidelines

### Code Style
- **TypeScript**: Strict typing with explicit annotations
- **Components**: Functional React components with hooks
- **Naming**: PascalCase for components, camelCase for functions
- **Error Handling**: Structured try/catch with proper logging
- **Documentation**: JSDoc comments for public APIs

### Commit Conventions
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation updates
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions or updates
- `chore:` Maintenance tasks

### Testing Strategy
- **Unit Tests**: Component and utility testing
- **Integration Tests**: API and workflow testing
- **E2E Tests**: Complete user journey testing
- **Performance Tests**: Load and stress testing

## 🤝 Contributing

### Development Workflow
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'feat: add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Review Process
- All changes require code review
- Automated testing must pass
- Design system compliance required
- Performance impact assessment

## 📚 Documentation

- **Design System**: `/apps/simple-swap/DESIGN_SYSTEM.md`
- **API Documentation**: `/docs/api/`
- **Component Library**: `/packages/ui/README.md`
- **Deployment Guide**: `/docs/deployment.md`

## 🔗 Links

- **Website**: [https://charisma.rocks](https://charisma.rocks)
- **Swap Interface**: [https://swap.charisma.rocks](https://swap.charisma.rocks)
- **Documentation**: [https://docs.charisma.rocks](https://docs.charisma.rocks)
- **GitHub**: [https://github.com/pointblankdev/charisma-web](https://github.com/pointblankdev/charisma-web)
- **Twitter**: [@charisma_btc](https://twitter.com/charisma_btc)
- **Discord**: [Join Community](https://discord.gg/charisma)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Roadmap

### Q1 2024
- ✅ Advanced order types implementation
- ✅ Glass morphism design system
- ✅ Real-time analytics dashboard
- 🔄 Pro mode features
- 🔄 Mobile app development

### Q2 2024
- 📋 Cross-chain bridge integration
- 📋 Advanced portfolio management
- 📋 Social trading features
- 📋 API marketplace
- 📋 Institutional tools

---

Built with ❤️ by the Charisma team. Powered by Stacks blockchain.