# Lottery System Test Scripts

This directory contains TypeScript scripts for testing the lottery system end-to-end.

## Scripts Available

### `test-full-flow.ts`
Comprehensive end-to-end test that exercises the entire lottery system flow.

**What it tests:**
1. **Initial Configuration** - Gets current lottery config, jackpot, and draw time
2. **Ticket Purchases** - Tests single and bulk ticket purchases for multiple wallets
3. **Ticket Confirmation** - Confirms tickets via admin API
4. **User Ticket Retrieval** - Tests user-facing ticket APIs
5. **Admin Operations** - Tests admin ticket management
6. **Lottery Draw Execution** - Runs a complete lottery draw
7. **Results Retrieval** - Tests all result APIs
8. **Post-Draw State** - Verifies system state after draw completion

**Usage:**
```bash
cd scripts
npm run test:full
# or
npx tsx test-full-flow.ts
```

### `quick-test.ts`
Quick minimal test for development - purchases a ticket, confirms it, and runs a draw.

**Usage:**
```bash
cd scripts
npm run test:quick
# or
npx tsx quick-test.ts
```

**Prerequisites:**
- Lottery app running on `http://localhost:3013`
- Admin API key configured: `admin_api_key_xxx`
- Vercel blob storage set up and connected

**Output:**
- Detailed logs written to `/logs/e2e-test-YYYYMMDD-HHMMSS.log`
- Real-time progress displayed in terminal
- All API calls logged with request/response details

## Log Files

All test runs create detailed log files in the `/logs` directory with timestamps:
- API calls with full request/response data
- Test phase completion status
- Error details if any issues occur
- Performance timing information

## Test Wallets

The script uses these test wallet addresses:
- **Wallet 1**: `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS`
- **Wallet 2**: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM`

## Expected Flow

1. System starts with existing lottery configuration
2. Multiple tickets purchased across different wallets
3. Tickets confirmed via admin interface
4. Lottery draw executed with guaranteed winner
5. Results retrieved and verified
6. System reset for next draw cycle
7. New tickets can be purchased for next draw

## Troubleshooting

- **Connection errors**: Ensure the lottery app is running on port 3013
- **Authentication errors**: Verify admin API key matches environment
- **Blob storage errors**: Check Vercel blob configuration
- **No tickets found**: Ensure tickets are being confirmed properly

Check the detailed log files in `/logs` for specific error information.