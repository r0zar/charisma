# Meme Roulette Leaderboard System

## 🎯 Overview

The Meme Roulette Leaderboard System is a comprehensive player tracking and ranking solution built on Vercel KV (Redis). It tracks user activity, maintains multiple leaderboards, implements an achievement system, and provides real-time statistics.

## 📊 Architecture

### Data Model Design

The system uses a hierarchical key structure optimized for performance and scalability:

```
Key Pattern Structure:
├── user:{userId}:stats          # User aggregate statistics
├── user:{userId}:rounds         # User round participation history  
├── user:{userId}:achievements   # User achievements
├── leaderboard:total_cha        # Sorted set: Total CHA leaderboard
├── leaderboard:total_votes      # Sorted set: Vote count leaderboard
├── leaderboard:avg_vote         # Sorted set: Average vote leaderboard
├── leaderboard:biggest_vote     # Sorted set: Biggest vote leaderboard
├── leaderboard:current_round    # Sorted set: Current round leaderboard
├── round:{roundId}:meta         # Round metadata
├── round:{roundId}:participants # Round participants set
├── round:{roundId}:user_activity:{userId} # User activity in round
└── global:stats                 # Platform-wide statistics
```

### Core Data Types

#### UserStats
```typescript
interface UserStats {
  userId: string;
  displayName: string;
  totalCHACommitted: number;     // Lifetime CHA (atomic units)
  totalVotes: number;            // Total votes placed
  totalRoundsParticipated: number;
  averageVoteSize: number;       // Average CHA per vote
  biggestVote: number;           // Largest single vote
  totalEarnings: number;         // CHA earned from wins
  winCount: number;              // Rounds won
  lastActivityTime: number;      // Last vote timestamp
  firstActivityTime: number;     // First vote timestamp
  currentStreak: number;         // Consecutive rounds
  maxStreak: number;             // Max consecutive rounds
  achievements: string[];        // Achievement IDs
  updatedAt: number;             // Last update timestamp
}
```

#### Achievement System
```typescript
interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  type: 'milestone' | 'streak' | 'special' | 'earnings';
  threshold?: number;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}
```

## 🚀 Core Components

### 1. Data Layer (`leaderboard-kv.ts`)

**User Statistics Functions:**
- `getUserStats(userId)` - Get user stats with defaults
- `updateUserStatsAfterVote(userId, amount, roundId)` - Update stats after vote
- `updateUserStatsAfterRound(userId, roundId, isWinner, earnings)` - Update after round

**Leaderboard Functions:**
- `getLeaderboard(type, limit, offset)` - Get ranked leaderboard
- `getUserRank(userId, type)` - Get user's rank in leaderboard

**Achievement Functions:**
- `checkAndAwardAchievements(userId)` - Check and award new achievements
- `initializeAchievements()` - Initialize achievement definitions

### 2. Integration Layer (`leaderboard-integration.ts`)

**Enhanced Functions:**
- `recordVoteWithLeaderboard(userId, tokenId, amount)` - Record vote + update leaderboard
- `completeRoundWithLeaderboard(winningTokenId, rewards)` - Complete round + update stats
- `getUserProfile(userId)` - Get comprehensive user profile

### 3. API Layer (`/api/leaderboard/route.ts`)

**GET Endpoints:**
- `?action=leaderboard&type=total_cha&limit=50` - Get leaderboard
- `?action=user_profile&userId=...` - Get user profile with ranks
- `?action=user_stats&userId=...` - Get user stats only
- `?action=init` - Initialize system

**POST Endpoints:**
- `record_vote` - Record vote (future integration)
- `complete_round` - Complete round (future integration)

### 4. Frontend Hooks (`useLeaderboard.ts`)

**Available Hooks:**
- `useLeaderboard(options)` - Main leaderboard data
- `useUserProfile(userId, options)` - User profile with ranks
- `useUserStats(userId, options)` - User stats only
- `useCurrentUserProfile(userId)` - Current user profile
- `useLeaderboardInit()` - System initialization

## 📈 Leaderboard Types

### 1. Total CHA (`total_cha`)
- **Metric**: Lifetime CHA committed across all rounds
- **Use Case**: Overall player contribution ranking
- **Update**: Real-time with each vote

### 2. Total Votes (`total_votes`)
- **Metric**: Total number of votes placed
- **Use Case**: Activity level ranking
- **Update**: Real-time with each vote

### 3. Average Vote (`avg_vote`)
- **Metric**: Average CHA per vote
- **Use Case**: Bet size preference ranking
- **Update**: Calculated from total CHA / total votes

### 4. Biggest Vote (`biggest_vote`)
- **Metric**: Largest single vote amount
- **Use Case**: "High roller" ranking
- **Update**: When new personal best is set

### 5. Current Round (`current_round`)
- **Metric**: CHA committed in active round
- **Use Case**: Round-specific competition
- **Update**: Real-time during round, reset each round

### 6. Recent Activity (`recent_activity`)
- **Metric**: Last activity timestamp
- **Use Case**: Most active users
- **Update**: Real-time with each vote

## 🏆 Achievement System

### Milestone Achievements
- **First Vote** (🎯): Place your first vote
- **Century Club** (💯): Commit 100 CHA total
- **Thousand Strong** (🚀): Commit 1,000 CHA total
- **High Roller** (🎰): Single vote of 100+ CHA
- **Crypto Whale** (🐋): Single vote of 500+ CHA

### Streak Achievements
- **Consistent Player** (🔥): 5 consecutive rounds
- **Dedicated Trader** (⚡): 20 consecutive rounds

### Special Achievements
- **Beginner's Luck** (🍀): Win on first round
- **History Maker** (📈): Participate in ATH round

## 🔧 Usage Examples

### Basic Leaderboard Display

```tsx
import { useLeaderboard } from '@/hooks/useLeaderboard';

function LeaderboardComponent() {
  const { data, isLoading, error, refresh } = useLeaderboard({
    type: 'total_cha',
    limit: 50,
    refreshInterval: 30000
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {data?.entries.map(entry => (
        <div key={entry.userId}>
          #{entry.rank} {entry.displayName} - {entry.score} CHA
        </div>
      ))}
    </div>
  );
}
```

### User Profile with Rankings

```tsx
import { useUserProfile } from '@/hooks/useLeaderboard';

function UserProfileComponent({ userId }: { userId: string }) {
  const { data, isLoading, error } = useUserProfile(userId);

  if (isLoading) return <div>Loading profile...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>{data?.stats.displayName}</h2>
      <p>Total CHA: {data?.stats.totalCHACommitted}</p>
      <p>Total CHA Rank: #{data?.totalCHARank}</p>
      <p>Achievements: {data?.stats.achievements.length}</p>
    </div>
  );
}
```

### Integration with Voting

```tsx
import { recordVoteWithLeaderboard } from '@/lib/leaderboard-integration';

async function handleVote(userId: string, tokenId: string, amount: number) {
  try {
    const { vote, achievements } = await recordVoteWithLeaderboard(
      userId, 
      tokenId, 
      amount
    );
    
    if (vote) {
      console.log('Vote recorded:', vote);
      
      // Show achievement notifications
      achievements.forEach(achievement => {
        showAchievementNotification(achievement);
      });
    }
  } catch (error) {
    console.error('Failed to record vote:', error);
  }
}
```

## ⚙️ Configuration

### Environment Variables
```env
# Vercel KV is automatically configured
# No additional environment variables needed
```

### Initialization
```typescript
import { initializeIntegratedSystem } from '@/lib/leaderboard-integration';

// Initialize the system (run once)
await initializeIntegratedSystem();
```

## 🔄 Data Flow

### 1. User Places Vote
```
User Vote → recordVoteWithLeaderboard() → {
  ├── Record vote in existing system
  ├── Update user stats
  ├── Update leaderboards (sorted sets)
  ├── Record round activity
  └── Check/award achievements
}
```

### 2. Round Completion
```
Round Ends → completeRoundWithLeaderboard() → {
  ├── Set winning token
  ├── Update winner stats
  ├── Award earnings
  ├── Reset current round leaderboard
  └── Initialize next round
}
```

### 3. Frontend Data Access
```
Component → useLeaderboard() → {
  ├── Fetch from API
  ├── Auto-refresh interval
  ├── Error handling
  └── Cache management
}
```

## 📊 Performance Considerations

### Efficient Operations
- **Sorted Sets**: O(log N) inserts/updates for leaderboards
- **Atomic Updates**: Use Redis transactions for consistency
- **Batch Queries**: Fetch user stats in parallel
- **Caching**: Frontend hooks cache data and auto-refresh

### Scalability
- **Key Distribution**: Well-distributed key patterns
- **Data Expiration**: Implement cleanup for old rounds
- **Pagination**: Leaderboards support offset/limit
- **Memory Usage**: Efficient data structures

## 🚨 Error Handling

### Backend
- Graceful degradation for KV failures
- Comprehensive logging for debugging
- Fallback to default values when data missing

### Frontend
- Request cancellation for stale requests
- Retry logic with exponential backoff
- Loading states and error boundaries

## 🔮 Future Enhancements

### Planned Features
1. **Historical Rankings**: Track rank changes over time
2. **Seasonal Leaderboards**: Reset leaderboards periodically
3. **Team Competitions**: Group-based achievements
4. **Advanced Analytics**: Detailed player insights
5. **Social Features**: Following, friends leaderboards

### Migration Strategy
- **Batch Updates**: Migrate existing user data
- **Gradual Rollout**: Feature flags for new functionality
- **Data Validation**: Verify data integrity during migration

## 📝 Maintenance

### Regular Tasks
- Monitor KV usage and performance
- Clean up old round data (keep last 100 rounds)
- Update achievement thresholds based on player behavior
- Backup critical leaderboard data

### Monitoring
- Track API response times
- Monitor KV storage usage
- Alert on error rates
- Dashboard for system health

---

## 🤝 Contributing

When extending the leaderboard system:

1. **Follow Patterns**: Use established key patterns and naming
2. **Test Thoroughly**: Include unit tests for new functions
3. **Document Changes**: Update this README and inline docs
4. **Performance**: Consider impact on KV operations
5. **Backward Compatibility**: Don't break existing data structures

## 📚 API Reference

### Complete API Documentation

See individual function documentation in:
- `leaderboard-kv.ts` - Core data operations
- `leaderboard-integration.ts` - Integration functions
- `useLeaderboard.ts` - Frontend hooks
- `/api/leaderboard/route.ts` - HTTP endpoints 