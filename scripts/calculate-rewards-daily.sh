#!/bin/bash
# Daily reward calculation script
# Run this via cron: 0 2 * * * /path/to/scripts/calculate-rewards-daily.sh

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# API endpoint (defaults to localhost:3000)
API_URL="${API_URL:-http://localhost:3000}"

# Log file
LOG_FILE="${LOG_FILE:-./logs/reward-calculation.log}"
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting daily reward calculation..."

# Check if API is available
if ! curl -f -s "${API_URL}/api/training/calculate-pending" > /dev/null 2>&1; then
    log "ERROR: API not available at ${API_URL}"
    exit 1
fi

# Get pending count
PENDING=$(curl -s "${API_URL}/api/training/calculate-pending" | grep -o '"pendingRewards":[0-9]*' | grep -o '[0-9]*')

if [ -z "$PENDING" ] || [ "$PENDING" = "0" ]; then
    log "No pending rewards to calculate"
    exit 0
fi

log "Found $PENDING pending rewards"

# Calculate rewards
RESPONSE=$(curl -s -X POST "${API_URL}/api/training/calculate-pending" \
    -H "Content-Type: application/json")

if echo "$RESPONSE" | grep -q '"success":true'; then
    PROCESSED=$(echo "$RESPONSE" | grep -o '"processed":[0-9]*' | grep -o '[0-9]*')
    ERRORS=$(echo "$RESPONSE" | grep -o '"errors":[0-9]*' | grep -o '[0-9]*')
    log "✅ Successfully processed $PROCESSED rewards ($ERRORS errors)"
else
    log "ERROR: Failed to calculate rewards - $RESPONSE"
    exit 1
fi

log "Daily reward calculation complete"
