#!/bin/bash

# Retry migration until it succeeds
# Sleeps 30 seconds between attempts

set -e

echo "🔄 Starting migration retry loop..."
echo "   Will retry every 30 seconds until successful"
echo ""

ATTEMPT=1

while true; do
  echo "[Attempt $ATTEMPT] Running migration..."
  
  if npx prisma migrate dev --name add_raison_detre_to_opus; then
    echo ""
    echo "✅ Migration succeeded on attempt $ATTEMPT!"
    exit 0
  else
    echo ""
    echo "❌ Migration failed on attempt $ATTEMPT"
    echo "⏳ Waiting 30 seconds before retry..."
    sleep 30
    ATTEMPT=$((ATTEMPT + 1))
  fi
done
