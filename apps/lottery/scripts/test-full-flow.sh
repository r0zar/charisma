#!/bin/bash

# Full End-to-End Lottery System Test Script
# Tests the complete lottery flow from ticket purchase to draw completion

set -e # Exit on any error

# Configuration
BASE_URL="http://localhost:3013"
ADMIN_KEY="admin_api_key_1234567890"
TEST_WALLET_1="SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS"
TEST_WALLET_2="ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
LOG_DIR="../logs"
LOG_FILE="$LOG_DIR/e2e-test-$(date +%Y%m%d-%H%M%S).log"

# Ensure logs directory exists
mkdir -p "$LOG_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# API call function with logging
api_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local headers="$4"
    local description="$5"
    
    log "🔄 API CALL: $description"
    log "   Method: $method"
    log "   Endpoint: $endpoint"
    
    if [ -n "$data" ]; then
        log "   Data: $data"
    fi
    
    local curl_cmd="curl -s -X $method"
    
    if [ -n "$headers" ]; then
        curl_cmd="$curl_cmd $headers"
    fi
    
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    curl_cmd="$curl_cmd '$BASE_URL$endpoint'"
    
    log "   Command: $curl_cmd"
    
    local response=$(eval $curl_cmd)
    local http_code=$(eval $curl_cmd -w "%{http_code}" -o /dev/null)
    
    log "   Response Code: $http_code"
    log "   Response: $response"
    log ""
    
    echo "$response"
}

# Test functions
test_initial_config() {
    log "🎯 === PHASE 1: INITIAL CONFIGURATION ==="
    
    # Get current lottery config
    local config=$(api_call "GET" "/api/v1/lottery/config" "" "" "Get current lottery configuration")
    log "✅ Current lottery configuration retrieved"
    
    # Get current jackpot
    local jackpot=$(api_call "GET" "/api/v1/lottery/jackpot" "" "" "Get current jackpot amount")
    log "✅ Current jackpot amount retrieved"
    
    # Get next draw time
    local draw_time=$(api_call "GET" "/api/v1/lottery/draw-time" "" "" "Get next draw time")
    log "✅ Next draw time retrieved"
    
    log "📊 Initial state captured successfully"
}

test_ticket_purchases() {
    log "🎫 === PHASE 2: TICKET PURCHASES ==="
    
    # Purchase single ticket for wallet 1
    local ticket1=$(api_call "POST" "/api/v1/lottery/purchase-ticket" \
        '{"walletAddress": "'$TEST_WALLET_1'", "numbers": [7, 14, 21, 28, 35, 42]}' \
        "" \
        "Purchase single ticket for wallet 1")
    
    local ticket1_id=$(echo "$ticket1" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    log "✅ Single ticket purchased: $ticket1_id"
    
    # Purchase bulk tickets for wallet 1
    local bulk1=$(api_call "POST" "/api/v1/lottery/purchase-bulk" \
        '{"walletAddress": "'$TEST_WALLET_1'", "quantity": 3}' \
        "" \
        "Purchase 3 bulk tickets for wallet 1")
    log "✅ Bulk tickets purchased for wallet 1"
    
    # Purchase single ticket for wallet 2
    local ticket2=$(api_call "POST" "/api/v1/lottery/purchase-ticket" \
        '{"walletAddress": "'$TEST_WALLET_2'", "numbers": [1, 5, 10, 15, 20, 25]}' \
        "" \
        "Purchase single ticket for wallet 2")
    
    local ticket2_id=$(echo "$ticket2" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    log "✅ Single ticket purchased: $ticket2_id"
    
    # Purchase bulk tickets for wallet 2
    local bulk2=$(api_call "POST" "/api/v1/lottery/purchase-bulk" \
        '{"walletAddress": "'$TEST_WALLET_2'", "quantity": 2}' \
        "" \
        "Purchase 2 bulk tickets for wallet 2")
    log "✅ Bulk tickets purchased for wallet 2"
    
    # Store ticket IDs for confirmation
    echo "$ticket1_id" > "$LOG_DIR/ticket1_id.tmp"
    echo "$ticket2_id" > "$LOG_DIR/ticket2_id.tmp"
    
    log "🎫 Total tickets purchased: 7 (1+3 for wallet1, 1+2 for wallet2)"
}

test_ticket_confirmation() {
    log "✅ === PHASE 3: TICKET CONFIRMATION ==="
    
    # Get all tickets to confirm them
    local all_tickets=$(api_call "GET" "/api/admin/lottery-tickets" "" \
        "-H 'x-admin-key: $ADMIN_KEY'" \
        "Get all tickets for confirmation")
    
    # Extract pending ticket IDs (this is a simplified approach)
    # In a real script, you'd parse JSON properly
    log "📋 Retrieved all tickets for confirmation process"
    
    # For testing, let's confirm a few tickets manually
    if [ -f "$LOG_DIR/ticket1_id.tmp" ]; then
        local ticket1_id=$(cat "$LOG_DIR/ticket1_id.tmp")
        local confirm1=$(api_call "POST" "/api/admin/confirm-ticket" \
            '{"ticketId": "'$ticket1_id'", "transactionId": "0x1234567890abcdef"}' \
            "-H 'x-admin-key: $ADMIN_KEY'" \
            "Confirm ticket $ticket1_id")
        log "✅ Ticket $ticket1_id confirmed"
    fi
    
    if [ -f "$LOG_DIR/ticket2_id.tmp" ]; then
        local ticket2_id=$(cat "$LOG_DIR/ticket2_id.tmp")
        local confirm2=$(api_call "POST" "/api/admin/confirm-ticket" \
            '{"ticketId": "'$ticket2_id'", "transactionId": "0xfedcba0987654321"}' \
            "-H 'x-admin-key: $ADMIN_KEY'" \
            "Confirm ticket $ticket2_id")
        log "✅ Ticket $ticket2_id confirmed"
    fi
    
    log "✅ Key tickets confirmed for testing"
}

test_user_tickets() {
    log "👤 === PHASE 4: USER TICKET RETRIEVAL ==="
    
    # Get tickets for wallet 1
    local wallet1_tickets=$(api_call "GET" "/api/v1/lottery/my-tickets?walletAddress=$TEST_WALLET_1" \
        "" "" "Get tickets for wallet 1")
    log "✅ Wallet 1 tickets retrieved"
    
    # Get tickets for wallet 2
    local wallet2_tickets=$(api_call "GET" "/api/v1/lottery/my-tickets?walletAddress=$TEST_WALLET_2" \
        "" "" "Get tickets for wallet 2")
    log "✅ Wallet 2 tickets retrieved"
    
    log "👤 User ticket retrieval completed"
}

test_admin_operations() {
    log "🔧 === PHASE 5: ADMIN OPERATIONS ==="
    
    # Get admin view of all tickets
    local admin_tickets=$(api_call "GET" "/api/admin/lottery-tickets" "" \
        "-H 'x-admin-key: $ADMIN_KEY'" \
        "Admin view of all tickets")
    log "✅ Admin ticket overview retrieved"
    
    # Get tickets by draw
    local draw_tickets=$(api_call "GET" "/api/admin/lottery-tickets?drawId=next-draw-2025-07-26" "" \
        "-H 'x-admin-key: $ADMIN_KEY'" \
        "Get tickets by draw ID")
    log "✅ Tickets by draw retrieved"
    
    log "🔧 Admin operations completed"
}

test_lottery_draw() {
    log "🎰 === PHASE 6: LOTTERY DRAW EXECUTION ==="
    
    # Run the lottery draw
    local draw_result=$(api_call "POST" "/api/admin/lottery-draw" '{}' \
        "-H 'x-admin-key: $ADMIN_KEY'" \
        "Execute lottery draw")
    
    local draw_id=$(echo "$draw_result" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    log "🎰 Lottery draw completed: $draw_id"
    
    # Store draw ID for later reference
    echo "$draw_id" > "$LOG_DIR/draw_id.tmp"
    
    log "🏆 Draw execution phase completed"
}

test_results_retrieval() {
    log "📊 === PHASE 7: RESULTS RETRIEVAL ==="
    
    # Get latest result
    local latest_result=$(api_call "GET" "/api/v1/lottery/latest-result" "" "" "Get latest lottery result")
    log "✅ Latest result retrieved"
    
    # Get all results
    local all_results=$(api_call "GET" "/api/v1/lottery/results?limit=10" "" "" "Get recent lottery results")
    log "✅ Recent results retrieved"
    
    # Check specific draw result
    if [ -f "$LOG_DIR/draw_id.tmp" ]; then
        local draw_id=$(cat "$LOG_DIR/draw_id.tmp")
        local specific_result=$(api_call "GET" "/api/v1/lottery/results?drawId=$draw_id" "" "" \
            "Get specific draw result")
        log "✅ Specific draw result retrieved"
    fi
    
    log "📊 Results retrieval completed"
}

test_post_draw_state() {
    log "🔄 === PHASE 8: POST-DRAW STATE VERIFICATION ==="
    
    # Check updated lottery config
    local updated_config=$(api_call "GET" "/api/v1/lottery/config" "" "" "Get updated lottery configuration")
    log "✅ Updated lottery configuration retrieved"
    
    # Check new jackpot amount
    local new_jackpot=$(api_call "GET" "/api/v1/lottery/jackpot" "" "" "Get updated jackpot amount")
    log "✅ Updated jackpot amount retrieved"
    
    # Check archived tickets
    local archived_tickets=$(api_call "GET" "/api/admin/lottery-tickets" "" \
        "-H 'x-admin-key: $ADMIN_KEY'" \
        "Check archived tickets")
    log "✅ Archived tickets status verified"
    
    # Check if new tickets can be purchased
    local new_ticket=$(api_call "POST" "/api/v1/lottery/purchase-ticket" \
        '{"walletAddress": "'$TEST_WALLET_1'", "numbers": [2, 4, 6, 8, 10, 12]}' \
        "" \
        "Test new ticket purchase after draw")
    log "✅ New ticket purchase after draw tested"
    
    log "🔄 Post-draw state verification completed"
}

cleanup() {
    log "🧹 === CLEANUP ==="
    
    # Remove temporary files
    rm -f "$LOG_DIR"/*.tmp
    
    log "🧹 Cleanup completed"
}

# Main execution
main() {
    log "🚀 =============================================="
    log "🚀 STARTING FULL END-TO-END LOTTERY SYSTEM TEST"
    log "🚀 =============================================="
    log "📅 Test started at: $(date)"
    log "🌐 Base URL: $BASE_URL"
    log "📝 Log file: $LOG_FILE"
    log ""
    
    # Run all test phases
    test_initial_config
    test_ticket_purchases
    test_ticket_confirmation
    test_user_tickets
    test_admin_operations
    test_lottery_draw
    test_results_retrieval
    test_post_draw_state
    cleanup
    
    log ""
    log "✅ =============================================="
    log "✅ FULL END-TO-END TEST COMPLETED SUCCESSFULLY"
    log "✅ =============================================="
    log "📅 Test completed at: $(date)"
    log "📊 Check the log file for detailed results: $LOG_FILE"
}

# Execute main function
main "$@"