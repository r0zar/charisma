# Meme Roulette Balance Validation System

## 🎯 Overview

The Meme Roulette now includes a robust balance validation system that ensures users have sufficient CHA tokens to fulfill their votes before the spin phase. This prevents unfair winner determination based on votes from users who no longer have the required tokens.

## 🔍 How It Works

### Automatic Validation During Spin

When the spin time is reached, the system automatically:

1. **Validates User Balances**: Checks each user's current CHA balance against their total committed votes
2. **Filters Invalid Votes**: Excludes votes from users with insufficient balances
3. **Cleans Intent Queue**: Removes invalid swap intents from the processing queue
4. **Determines Winner**: Uses only validated votes for fair winner selection
5. **Processes Valid Swaps**: Only executes swaps for users with confirmed balances

### Balance Validation Logic

```typescript
// User is considered valid if:
currentBalance >= totalCommittedVotes

// Invalid users have ALL their votes excluded (not partially reduced)
```

## 📊 Admin Endpoints

### Check Balance Validation (Read-Only)
```bash
GET /api/admin/validate-balances
```

Returns validation results without making any changes:
- Valid/invalid user counts
- Total CHA amounts
- Token bet distribution
- Detailed breakdown of invalid users

### Trigger Balance Validation & Cleanup
```bash
POST /api/admin/validate-balances
# Requires admin signature with message: "Validate user balances"
```

Performs validation and cleans the intent queue:
- Removes invalid intents from processing queue
- Provides detailed cleanup statistics
- Returns comprehensive validation report

## 🔧 User Balance Checking

### Enhanced Effective Balance Endpoint
```bash
GET /api/balance/effective-cha?userAddress=SP...
```

Now includes:
- `hasInsufficientBalance`: Boolean flag
- `balanceShortfall`: Amount short (if any)
- `warning`: Human-readable warning message

Example response for insufficient balance:
```json
{
  "success": true,
  "data": {
    "rawSubnetBalance": "5000000",
    "totalCommittedCHA": "10000000", 
    "effectiveSpendableBalance": "0",
    "hasInsufficientBalance": true,
    "balanceShortfall": "5000000",
    "warning": "User has insufficient balance. Short by 5000000 CHA (atomic units). Votes may be invalidated during spin."
  }
}
```

## 🚨 Important Behaviors

### All-or-Nothing Validation
- If a user has insufficient balance, **ALL** their votes are invalidated
- No partial vote reduction - this ensures clean winner determination
- Prevents gaming the system with strategic partial sales

### Queue Cleaning
- Invalid intents are completely removed from the processing queue
- Prevents failed transactions during multihop processing
- Maintains queue integrity for valid users

### Transparency
- All validation steps are logged with detailed information
- Invalid users and amounts are clearly tracked
- Provides audit trail for fairness verification

## 🎛️ Configuration

The system uses these key settings:

- **Token Contract**: `NEXT_PUBLIC_CHARISMA_CONTRACT_ID` (CHA subnet token)
- **Validation Timing**: Automatically triggered when spin time is reached
- **Error Handling**: On validation errors, all votes treated as invalid (fail-safe)

## 🧪 Testing

### Manual Validation
Use the admin endpoints to test balance validation without waiting for spin time:

```bash
# Check current validation status
curl https://your-app.com/api/admin/validate-balances

# Trigger validation and cleanup (requires signature)
curl -X POST https://your-app.com/api/admin/validate-balances \
  -H "Content-Type: application/json" \
  -d '{"signature": "...", "publicKey": "..."}'
```

### User Balance Monitoring
Monitor individual users for potential issues:

```bash
# Check if user might have validation issues
curl "https://your-app.com/api/balance/effective-cha?userAddress=SP1234..."
```

## 📈 Benefits

1. **Fair Play**: Only users with actual token balances get votes counted
2. **Reduced Failures**: Eliminates failed swap transactions from insufficient balances
3. **Transparency**: Clear logging and reporting of all validation steps
4. **Admin Control**: Manual validation tools for testing and monitoring
5. **User Awareness**: Balance warnings help users understand their status

## ⚠️ Considerations

- **Network Latency**: Balance checks add ~1-2 seconds to spin processing
- **Rate Limits**: Multiple balance API calls during validation (consider caching for high user counts)
- **All-or-Nothing**: Users lose ALL votes if short any amount (intentional design choice)

This system ensures the integrity and fairness of the Meme Roulette while providing transparency and control tools for both users and administrators. 