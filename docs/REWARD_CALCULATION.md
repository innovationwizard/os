# Reward Calculation Service

## Overview

The reward calculation service computes rewards for AI agent decisions using three types of signals:

1. **Immediate Rewards**: Available right after decision (user feedback, confidence calibration)
2. **Delayed Rewards**: Available when item reaches terminal state (completion success, blockage avoidance, etc.)
3. **Strategic Rewards**: Calculated from system-wide metrics (goal alignment, opportunity cost)

## Architecture

### Core Functions

- `calculateReward(decisionId: string)`: Calculate reward for a single decision
- `calculateRewardForDecision(decision: Decision)`: Calculate reward from Decision object
- `calculatePendingRewards()`: Background job to process all pending rewards

### Reward Components

Each agent has specific reward components:

#### FILER
- **Immediate**: `userFeedback`, `confidenceCalibration`
- **Delayed**: `completionSuccess`, `blockageAvoidance`, `reworkPenalty`, `timeEfficiency`
- **Strategic**: `goalAlignment`, `opportunityCost`

#### LIBRARIAN
- **Immediate**: `userFeedback`
- **Delayed**: `conflictPrevention`, `falsePositivePenalty`, `missedIssuePenalty`, `dependencyAccuracy`

#### PRIORITIZER
- **Immediate**: `userAcceptance`
- **Delayed**: `completionSuccess`, `timeEfficiency`, `strategicProgress`, `opportunityCost`
- **Contextual**: `energyAlignment`, `flowMaintenance`

#### STORER
- **Immediate**: `userAcceptance`, `editDistance`
- **Delayed**: `corpusCoherence`, `findability`, `duplicationPenalty`

#### RETRIEVER
- **Immediate**: `userAcceptance`, `editDistance`
- **Accuracy**: `citationCorrectness`, `hallucinationPenalty`, `completeness`
- **Quality**: `coherence`, `styleAlignment`

## Usage

### Calculate Single Reward

```typescript
import { calculateReward } from "@/lib/reward-calculator"

const reward = await calculateReward("decision-id-123")
console.log(`Reward: ${reward}`)
```

### Calculate Rewards via API

```bash
# Calculate specific decisions
curl -X POST http://localhost:3000/api/training/decisions \
  -H "Content-Type: application/json" \
  -d '{"decisionIds": ["id1", "id2", "id3"]}'

# Check pending rewards
curl http://localhost:3000/api/training/calculate-pending

# Calculate all pending rewards
curl -X POST http://localhost:3000/api/training/calculate-pending
```

### Background Job (Daily)

Set up a cron job to calculate rewards every 24 hours:

#### Option 1: Shell Script (Recommended)

```bash
# Add to crontab (crontab -e)
0 2 * * * cd /path/to/ocd && /bin/bash scripts/calculate-rewards-daily.sh >> logs/reward-calculation.log 2>&1
```

#### Option 2: Node.js Script

```bash
# Add to crontab (crontab -e)
0 2 * * * cd /path/to/ocd && node scripts/calculate-rewards-daily.js >> logs/reward-calculation.log 2>&1
```

#### Option 3: Simple curl (if API is accessible)

```bash
# Add to crontab (crontab -e)
0 2 * * * curl -X POST http://localhost:3000/api/training/calculate-pending >> /path/to/ocd/logs/reward-calculation.log 2>&1
```

#### Setup Instructions

1. **Copy example crontab**:
   ```bash
   cat crontab.example
   ```

2. **Edit your crontab**:
   ```bash
   crontab -e
   ```

3. **Add one of the options above** (replace `/path/to/ocd` with your actual path)

4. **Verify it's installed**:
   ```bash
   crontab -l
   ```

5. **Test manually**:
   ```bash
   # Test shell script
   bash scripts/calculate-rewards-daily.sh
   
   # Or test Node.js script
   node scripts/calculate-rewards-daily.js
   ```

#### Production Setup

For production, use your production API URL:

```bash
# In .env or crontab
API_URL=https://your-production-url.com
```

Or modify the script to use environment variables:

```bash
0 2 * * * cd /path/to/ocd && API_URL=https://your-production-url.com node scripts/calculate-rewards-daily.js
```

## Reward Calculation Details

### Expected Time Calculation

Expected time is calculated based on swimlane and priority:

- **EXPEDITE**: 120 minutes (2 hours)
- **PROJECT**: 480 minutes (8 hours)
- **HABIT**: 60 minutes (1 hour)
- **HOME**: 180 minutes (3 hours)

Priority multipliers:
- **HIGH**: 0.8x
- **MEDIUM**: 1.0x
- **LOW**: 1.2x

### Strategic Goal Progress

Determines current strategic priorities by analyzing recent completions:

- If more "Job 1 (Income)" items completed in last 7 days → Income is priority
- If more "Job 2 (Authority)" items completed → Authority is priority

### Confidence Calibration

Measures how well-calibrated the AI's confidence is:

```
confidenceCalibration = -|confidence - actual_correctness|
```

Where `actual_correctness` is 1 if user confirmed, 0 otherwise.

## Reward Weights

Reward weights are hyperparameters defined in `REWARD_WEIGHTS`:

```typescript
FILER: {
  immediate: {
    userFeedback: 1.0,           // Primary signal
    confidenceCalibration: 0.1
  },
  delayed: {
    completionSuccess: 0.5,
    blockageAvoidance: 0.3,
    reworkPenalty: 0.2,
    timeEfficiency: 0.3
  },
  strategic: {
    goalAlignment: 0.4,
    opportunityCost: 0.2
  }
}
```

These weights can be tuned based on training results.

## When Rewards Are Calculated

### Automatic (Background Job)

Rewards are calculated automatically when:
- Item reaches terminal state (DONE or COLD_STORAGE)
- Background job runs (hourly recommended)

### Manual

Rewards can be calculated manually:
- Via API endpoint: `POST /api/training/decisions`
- Via function: `calculateReward(decisionId)`

### User Feedback

When user provides feedback:
- Immediate reward components are updated
- Full reward is recalculated if item is complete

## Monitoring

Check reward calculation status:

```bash
# Get pending count
curl http://localhost:3000/api/training/calculate-pending

# Response:
{
  "pendingRewards": 42,
  "message": "42 decisions are ready for reward calculation"
}
```

## Troubleshooting

### Rewards Not Calculating

1. Check if item is in terminal state (DONE or COLD_STORAGE)
2. Verify decision has `reward: null`
3. Check database connection
4. Review error logs

### Incorrect Rewards

1. Verify outcome metrics are correct
2. Check reward component calculations
3. Review reward weights
4. Check strategic goal progress calculation

### Performance Issues

- Background job processes 100 decisions at a time
- Adjust batch size if needed
- Consider running more frequently with smaller batches
