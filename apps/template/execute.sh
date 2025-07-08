#!/bin/bash

# Script execution wrapper with timestamped logging
# Usage: ./execute.sh <path-to-ts-file>

set -e

# Check if file argument is provided
if [ $# -eq 0 ]; then
    echo "❌ Error: No TypeScript file specified"
    echo "Usage: $0 <path-to-ts-file>"
    echo "Example: $0 scripts/hello-world.ts"
    exit 1
fi

# Get the input file
TS_FILE="$1"

# Check if file exists
if [ ! -f "$TS_FILE" ]; then
    echo "❌ Error: File '$TS_FILE' not found"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Generate timestamp and log filename
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SCRIPT_NAME=$(basename "$TS_FILE" .ts)
LOG_FILE="logs/${TIMESTAMP}-${SCRIPT_NAME}.log"

# Print execution info
echo "🚀 Executing TypeScript script: $TS_FILE"
echo "📝 Logging to: $LOG_FILE"
echo "⏰ Started at: $(date)"
echo "----------------------------------------"

# Create log file with header
{
    echo "📋 Script Execution Log"
    echo "📁 File: $TS_FILE"
    echo "⏰ Started: $(date)"
    echo "👤 User: $(whoami)"
    echo "📂 Working Directory: $(pwd)"
    echo "🖥️  Platform: $(uname -s)"
    echo "📦 Node Version: $(node --version 2>/dev/null || echo 'Not available')"
    echo "🔧 TSX Version: $(npx tsx --version 2>/dev/null || echo 'Not available')"
    echo "----------------------------------------"
    echo ""
} > "$LOG_FILE"

# Execute the TypeScript file and capture all output
echo "▶️  Starting script execution..."

# Run tsx and capture its exit code
npx tsx "$TS_FILE" 2>&1 | tee -a "$LOG_FILE"
EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -eq 0 ]; then
    # Success
    echo "" | tee -a "$LOG_FILE"
    echo "✅ Script completed successfully" | tee -a "$LOG_FILE"
    echo "⏰ Finished at: $(date)" | tee -a "$LOG_FILE"
    
    # Show log file info
    echo ""
    echo "📋 Execution Summary:"
    echo "   📁 Log file: $LOG_FILE"
    echo "   📏 Log size: $(wc -l < "$LOG_FILE") lines"
    echo "   🕒 Duration: Started at $(head -n 20 "$LOG_FILE" | grep "Started:" | cut -d' ' -f3-)"
    
    exit 0
else
    # Error
    echo "" | tee -a "$LOG_FILE"
    echo "❌ Script failed with exit code $EXIT_CODE" | tee -a "$LOG_FILE"
    echo "⏰ Failed at: $(date)" | tee -a "$LOG_FILE"
    
    # Show log file info
    echo ""
    echo "📋 Execution Summary (FAILED):"
    echo "   📁 Log file: $LOG_FILE"
    echo "   📏 Log size: $(wc -l < "$LOG_FILE") lines"
    echo "   ❌ Exit code: $EXIT_CODE"
    echo "   📋 Check the log file for error details"
    
    exit $EXIT_CODE
fi