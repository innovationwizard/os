# RL Architecture - Agent-Specific State/Action Schemas

## Overview

This document describes the complete RL architecture with agent-specific state/action schemas and reward component structures.

## Agent Schemas

### 1. AI Filer

**Purpose**: Classify incoming items for workflow entry

**State Schema** (`FilerState`):
```typescript
{
  item: { id, title, rawInstructions, routingNotes }
  assignedOpus: { id, name, opusType, content (first 1000 chars), isStrategic } | null
  availableOpuses: Array<{ id, name, opusType }>
  strategicDocuments: Array<{ name, content }>
  userContext: { currentTime, recentDecisions (last 10) }
}
```

**Action Schema** (`FilerAction`):
```typescript
{
  status: "TODO" | "ON_HOLD" | "COMPENDIUM" | "TRASH"
  swimlane: "EXPEDITE" | "PROJECT" | "HABIT" | "HOME"
  priority: "HIGH" | "MEDIUM" | "LOW"
  labels: string[]
  confidence: number [0,1]
  reasoning: string
}
```

**Reward Components** (`FilerRewardComponents`):
- `immediate.userFeedback`: +1 confirmed, -0.5 corrected, 0 ignored
- `immediate.confidenceCalibration`: -|confidence - actual_correctness|
- `delayed.completionSuccess`: +0.5 if completed without cycles
- `delayed.blockageAvoidance`: -0.3 if item got blocked
- `delayed.reworkPenalty`: -0.1 * cycleCount
- `delayed.timeEfficiency`: +0.3 if under expected time
- `strategic.goalAlignment`: +0.2 if advanced strategic goals
- `strategic.opportunityCost`: -0.1 if higher-value item was available

### 2. AI Librarian

**Purpose**: Analyze new items against corpus and strategic goals

**State Schema** (`LibrarianState`):
```typescript
{
  newItem: { id, title, rawInstructions, routingNotes, opusId }
  opus: { id, name, content, isStrategic }
  corpus: Array<{ id, title, rawInstructions, status }> // Recent 50-100 items
  strategicDocuments: Array<{ name, content }>
}
```

**Action Schema** (`LibrarianAction`):
```typescript
{
  findings: Array<{
    type: "CONFLICT" | "DEPENDENCY" | "REDUNDANCY" | "RELATED" | "SUGGESTION"
    text: string
    confidence: number
    relatedItemIds: string[]
  }>
  reasoning: string
}
```

**Reward Components** (`LibrarianRewardComponents`):
- `immediate.userFeedback`: User marks findings as helpful/not helpful
- `delayed.conflictPrevention`: +1 if flagged conflict was validated
- `delayed.falsePositivePenalty`: -0.5 if flagged issue didn't occur
- `delayed.missedIssuePenalty`: -1 if real conflict occurred but wasn't flagged
- `delayed.dependencyAccuracy`: +0.5 if dependency was real

### 3. AI Prioritizer

**Purpose**: Select the next item to work on

**State Schema** (`PrioritizerState`):
```typescript
{
  availableItems: Array<{ id, title, rawInstructions, status, swimlane, priority, labels, opusId, statusChangedAt, lastProgressAt }>
  userContext: { currentTime, dayOfWeek, recentCompletions (last 5), currentFocus }
  strategicState: { incomeGoalProgress, authorityGoalProgress, urgentDeadlines }
  constraints: { wipCount, blockedCount, averageCycleTime }
}
```

**Action Schema** (`PrioritizerAction`):
```typescript
{
  recommendedItemId: string
  confidence: number
  reasoning: string
  alternativeItems: Array<{ itemId, score, reasoning }> // Top 3 alternatives
}
```

**Reward Components** (`PrioritizerRewardComponents`):
- `immediate.userAcceptance`: +1 if user chose this item, -0.5 if chose different
- `delayed.completionSuccess`: +1 if item completed smoothly
- `delayed.timeEfficiency`: +0.5 if completed faster than avg
- `delayed.strategicProgress`: +0.3 if advanced high-priority goal
- `delayed.opportunityCost`: -0.2 * value_of_best_alternative
- `contextual.energyAlignment`: Did item match user's energy level?
- `contextual.flowMaintenance`: Did it maintain momentum from previous work?

### 4. AI Storer

**Purpose**: Decide how to integrate completed items into opuses

**State Schema** (`StorerState`):
```typescript
{
  completedItem: { id, title, rawInstructions, routingNotes, labels, outcomeMetrics }
  targetOpus: { id, name, content, opusType, structure: { sections } }
  previousIntegrations: Array<{ itemTitle, location, method, wasSuccessful }> // Last 10
}
```

**Action Schema** (`StorerAction`):
```typescript
{
  integrationDecision: "INTEGRATE" | "COLD_STORAGE"
  location: string | null // Section name or "NEW_SECTION"
  method: "APPEND" | "MERGE" | "REPLACE" | "NEW_SECTION"
  newSectionHeading: string | null
  suggestedContent: string | null
  confidence: number
  reasoning: string
}
```

**Reward Components** (`StorerRewardComponents`):
- `immediate.userAcceptance`: +1 if accepted, -0.5 if rejected
- `immediate.editDistance`: -0.1 * (chars_changed / total_chars)
- `delayed.corpusCoherence`: +0.5 if opus remains coherent
- `delayed.findability`: +0.3 if content can be found via search
- `delayed.duplicationPenalty`: -0.5 if creates redundancy

### 5. AI Retriever

**Purpose**: Generate dynamic documents or answer queries from Opus Corpus

**State Schema** (`RetrieverState`):
```typescript
{
  query: string
  requestType: "GENERATE_DOCUMENT" | "ANSWER_QUESTION" | "FIND_CONTENT"
  parameters: { targetAudience?, context?, format? }
  relevantOpuses: Array<{ id, name, content, opusType, relevanceScore }>
  userHistory: { previousQueries, preferredSources }
}
```

**Action Schema** (`RetrieverAction`):
```typescript
{
  generatedContent: string
  sourceCitations: Array<{ opusId, opusName, excerpt }>
  confidence: number
  reasoning: string
}
```

**Reward Components** (`RetrieverRewardComponents`):
- `immediate.userAcceptance`: +1 if accepted, -1 if rejected
- `immediate.editDistance`: -0.1 * (chars_changed / total_chars)
- `accuracy.citationCorrectness`: +0.5 if all citations are accurate
- `accuracy.hallucinationPenalty`: -1 per hallucinated fact
- `accuracy.completeness`: +0.3 if all relevant info included
- `quality.coherence`: Measured by user rating or readability score
- `quality.styleAlignment`: +0.2 if matches user's writing style

## Reward Weights

Hyperparameters defined in `src/lib/reward-calculator.ts`:

```typescript
REWARD_WEIGHTS = {
  FILER: {
    immediate: { userFeedback: 1.0, confidenceCalibration: 0.1 },
    delayed: { completionSuccess: 0.5, blockageAvoidance: 0.3, reworkPenalty: 0.2, timeEfficiency: 0.3 },
    strategic: { goalAlignment: 0.4, opportunityCost: 0.2 }
  },
  LIBRARIAN: {
    immediate: { userFeedback: 1.0 },
    delayed: { conflictPrevention: 2.0, falsePositivePenalty: 0.5, missedIssuePenalty: 2.0, dependencyAccuracy: 0.5 }
  },
  PRIORITIZER: {
    immediate: { userAcceptance: 1.0 },
    delayed: { completionSuccess: 1.0, timeEfficiency: 0.5, strategicProgress: 0.8, opportunityCost: 0.3 },
    contextual: { energyAlignment: 0.2, flowMaintenance: 0.2 }
  },
  STORER: {
    immediate: { userAcceptance: 1.0, editDistance: 0.5 },
    delayed: { corpusCoherence: 0.7, findability: 0.6, duplicationPenalty: 0.4 }
  },
  RETRIEVER: {
    immediate: { userAcceptance: 1.0, editDistance: 0.5 },
    accuracy: { citationCorrectness: 0.8, hallucinationPenalty: 2.0, completeness: 0.6 },
    quality: { coherence: 0.4, styleAlignment: 0.3 }
  }
}
```

## Reward Calculation

The `calculateReward()` function in `src/lib/reward-calculator.ts`:

1. Calculates agent-specific reward components
2. Applies weights from `REWARD_WEIGHTS`
3. Computes weighted sum
4. Stores breakdown in `rewardComponents` JSONB field
5. Clamps final reward to [-5.0, 5.0] range

## Files

- `src/lib/agent-schemas.ts`: TypeScript interfaces for all agent state/action schemas
- `src/lib/reward-calculator.ts`: Centralized reward calculation with weights
- `src/lib/decision-recorder.ts`: Decision recording utilities
- `src/app/api/training/decisions/route.ts`: API for calculating rewards
- `src/app/api/training/export/route.ts`: JSONL export for training data

## Usage

### Recording a Decision

```typescript
import { recordDecision } from "@/lib/decision-recorder"
import { AgentType } from "@prisma/client"
import type { FilerState, FilerAction } from "@/lib/agent-schemas"

const state: FilerState = { /* ... */ }
const action: FilerAction = { /* ... */ }

await recordDecision({
  agentType: AgentType.FILER,
  state,
  action,
  userId: session.user.id,
  modelVersion: "gpt-4.1-mini-20250101",
  itemId: item.id,
  opusId: opus?.id,
  confidence: 0.85,
  reasoning: "Classified as Expedite due to urgent stakeholder request"
})
```

### Calculating Rewards

```typescript
import { calculateReward } from "@/lib/reward-calculator"

const decision = await prisma.decision.findUnique({ where: { id } })
const { reward, components } = await calculateReward(decision)
// Reward is stored in decision.reward
// Components breakdown is stored in decision.rewardComponents
```

## Next Steps

1. **Collect Training Data**: System automatically records all decisions
2. **Provide Feedback**: Use UI to confirm/correct decisions
3. **Calculate Rewards**: Call `POST /api/training/decisions` with decision IDs
4. **Export Training Data**: Use `GET /api/training/export?agentType=FILER&requireReward=true`
5. **Tune Weights**: Adjust `REWARD_WEIGHTS` based on training results
6. **Train Models**: Feed JSONL to RL training pipeline (PPO/RLHF)
