# Meme Roulette

A gamified token roulette platform where users can bet on Stacks ecosystem tokens with spin-based mechanics, referral systems, and achievement progression.

## Features

- **Token Roulette**: Spin-based betting on various Stacks ecosystem tokens
- **Referral System**: Multi-level referral rewards and viral mechanics
- **Achievement System**: Unlock badges and rewards through gameplay
- **Leaderboards**: Real-time ranking system with experience points
- **Social Features**: Twitter integration and sharing capabilities
- **Admin Controls**: Game configuration and balance management tools

## Development

```bash
# Install dependencies
pnpm install

# Start development server (runs on port 3010)
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
- **Styling**: Tailwind CSS with custom animations
- **State Management**: React Context with custom hooks
- **Storage**: Vercel KV for game state and user data
- **Animations**: Framer Motion for spin animations and confetti
- **Monitoring**: Sentry for error tracking and performance monitoring

### Game Mechanics

#### Spin System
- Configurable spin duration and lock periods
- Fair random number generation with cryptographic security
- Multi-token betting with weighted probabilities
- Real-time balance validation and atomic transactions

#### Referral Network
- Hierarchical referral tracking with depth limits
- Commission-based reward distribution
- Anti-fraud measures and circular referral prevention
- Viral coefficient tracking and optimization

#### Achievement Engine
- Experience point accumulation through gameplay
- Badge unlock system with progressive rewards
- Social sharing integration for achievement highlights
- Leaderboard integration with seasonal resets

## Script Runner

This project includes an elegant script runner system for debugging, testing, and data analysis:

```bash
# List available scripts
pnpm script list

# Run a specific script
pnpm script <script-name> [args...]

# Examples
pnpm script analyze-spin-data
pnpm script test-game-mechanics
pnpm script debug-referral-system
pnpm script test-game-mechanics spin 1000
pnpm script debug-referral-system ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM 3
```

### Script Capabilities

The script runner provides:

- **TypeScript Support**: Run `.ts` files directly with automatic compilation
- **Environment Variables**: Automatic loading from `.env` files with priority order
- **Auto-discovery**: Scripts are automatically detected in the `scripts/` folder
- **Argument Passing**: Pass command-line arguments to your scripts
- **Project Context**: Full access to project dependencies and utilities

### Use Cases

1. **Game Analytics & Optimization**
   - Analyze spin outcomes and fairness metrics
   - Track player behavior and betting patterns
   - Monitor token popularity and win rates
   - Generate revenue and engagement reports

2. **System Testing & Validation**
   - Test spin mechanics and randomness quality
   - Validate balance consistency and atomic operations
   - Load test concurrent betting scenarios
   - Verify referral calculation accuracy

3. **Data Analysis & Insights**
   - Analyze referral network effectiveness
   - Track user retention and lifetime value
   - Monitor social features usage and impact
   - Generate compliance reports for gaming regulations

4. **Migrations & Maintenance**
   - Migrate user data and game state
   - Backfill historical achievements and scores
   - Update referral commission structures
   - Batch process pending rewards

### Creating New Scripts

To create a new script:

1. Add a `.ts` file to the `scripts/` directory
2. Write your script using project imports and environment variables
3. Run with `pnpm script <your-script-name>`

No need to modify `package.json` - scripts are auto-discovered!

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Vercel KV (required for game state)
KV_URL=your_kv_url_here
KV_REST_API_URL=your_kv_rest_api_url_here
KV_REST_API_TOKEN=your_kv_rest_api_token_here

# Game Configuration
SPIN_DURATION_MS=30000
LOCK_DURATION_MS=5000
MIN_BET_AMOUNT=1000000

# API Keys
HIRO_API_KEY=your_hiro_api_key_here

# Admin Features
ADMIN_ADDRESSES=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM

# Monitoring
SENTRY_DSN=your_sentry_dsn_here
VERCEL_ANALYTICS_ID=your_analytics_id_here

# Development
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3010
```

## API Routes

### Game APIs
- `GET /api/spin/status` - Current spin state and timing
- `POST /api/spin/bet` - Place bet on upcoming spin
- `POST /api/spin/trigger` - Trigger spin execution (admin)

### User APIs
- `GET /api/user/[address]/stats` - User statistics and achievements
- `GET /api/user/[address]/referrals` - Referral network data
- `POST /api/user/[address]/redeem` - Redeem referral rewards

### Leaderboard APIs
- `GET /api/leaderboard` - Current leaderboard rankings
- `GET /api/leaderboard/history` - Historical leaderboard data

### Admin APIs
- `POST /api/admin/config` - Update game configuration
- `GET /api/admin/stats` - System-wide game statistics
- `POST /api/admin/balance` - Validate user balances

## Game Configuration

### Spin Mechanics
- **Spin Duration**: Time between bet closing and result reveal
- **Lock Duration**: Buffer time before next betting round opens
- **Minimum Bet**: Smallest allowable bet amount per token
- **Token Weights**: Relative probability weights for each token

### Referral System
- **Commission Rates**: Percentage rewards for different referral levels
- **Maximum Depth**: How many referral levels are tracked
- **Minimum Activity**: Required betting volume for referral eligibility

### Achievement System
- **Experience Points**: Points awarded for various game actions
- **Badge Thresholds**: XP requirements for different achievement levels
- **Seasonal Resets**: Periodic leaderboard and achievement resets

## Deployment

### Vercel Deployment
1. Connect repository to Vercel
2. Configure environment variables including game parameters
3. Deploy automatically on push to main

### Performance Considerations
- Atomic KV operations for bet placement and balance updates
- Optimistic UI updates with rollback on failure
- Efficient referral tree traversal algorithms
- Cached leaderboard calculations with periodic updates

## Contributing

1. Follow TypeScript strict typing for game logic
2. Test all game mechanics thoroughly before deployment
3. Ensure fair play and anti-manipulation measures
4. Add comprehensive logging for audit trails
5. Update documentation for game rule changes

## Troubleshooting

### Common Issues

**Bet Validation Failures**: Check minimum bet amounts and user balances
**Referral Chain Breaks**: Verify referral code generation and tracking
**Spin Timing Issues**: Ensure proper synchronization of game timers
**Balance Inconsistencies**: Run balance validation scripts regularly

### Debug Mode
Use the script runner system to analyze game state, test mechanics, and debug issues in real-time.