#!/bin/bash

# Quick Lottery System Test - Minimal flow for development testing

set -e

BASE_URL="http://localhost:3013"
ADMIN_KEY="admin_api_key_1234567890"
WALLET="SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS"
LOG_DIR="../logs"
LOG_FILE="$LOG_DIR/quick-test-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "🚀 Starting quick lottery test..."

# 1. Check system status
log "📊 Getting current system status..."
curl -s "$BASE_URL/api/v1/lottery/jackpot" >> "$LOG_FILE"

# 2. Purchase a ticket
log "🎫 Purchasing test ticket..."
TICKET_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "'$WALLET'", "numbers": [1, 2, 3, 4, 5, 6]}' \
  "$BASE_URL/api/v1/lottery/purchase-ticket")

echo "$TICKET_RESPONSE" >> "$LOG_FILE"
TICKET_ID=$(echo "$TICKET_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
log "✅ Ticket purchased: $TICKET_ID"

# 3. Confirm the ticket (admin)
log "✅ Confirming ticket..."
curl -s -X POST \
  -H "x-admin-key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ticketId": "'$TICKET_ID'", "transactionId": "0xtest123"}' \
  "$BASE_URL/api/admin/confirm-ticket" >> "$LOG_FILE"

# 4. Run lottery draw
log "🎰 Running lottery draw..."
DRAW_RESPONSE=$(curl -s -X POST \
  -H "x-admin-key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE_URL/api/admin/lottery-draw")

echo "$DRAW_RESPONSE" >> "$LOG_FILE"

if echo "$DRAW_RESPONSE" | grep -q '"success":true'; then
    log "🏆 Draw completed successfully!"
    
    # 5. Get results
    log "📊 Getting latest results..."
    curl -s "$BASE_URL/api/v1/lottery/latest-result" >> "$LOG_FILE"
    
    log "✅ Quick test completed successfully!"
else
    log "❌ Draw failed - check log for details"
    echo "$DRAW_RESPONSE"
fi

log "📝 Full log: $LOG_FILE"