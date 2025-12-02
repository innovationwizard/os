import { AgentType } from "@prisma/client"

/**
 * Model version configuration for A/B testing
 * Each agent can have multiple versions with weights for random assignment
 */
export interface ModelVersionConfig {
  version: string
  weight: number // 0.0 to 1.0, relative probability of selection
  description?: string // Optional description
}

/**
 * Model registry with support for A/B testing
 * Each agent type can have multiple versions with weights
 * Weights are normalized automatically (e.g., [1, 1] = 50/50 split)
 */
export const MODEL_REGISTRY: Record<AgentType, ModelVersionConfig[]> = {
  FILER: [
    { version: "gpt-4.1-mini-20250929", weight: 1.0, description: "Base model" },
    // Add new versions for A/B testing:
    // { version: "ocd-filer-v2", weight: 1.0, description: "Fine-tuned v2" }
  ],
  LIBRARIAN: [
    { version: "gpt-4.1-mini-20250929", weight: 1.0, description: "Base model" }
  ],
  PRIORITIZER: [
    { version: "ocd-prioritizer-v2", weight: 1.0, description: "Fine-tuned v2" },
    // { version: "gpt-4.1-mini-20250929", weight: 0.5, description: "Base model (test)" }
  ],
  STORER: [
    { version: "gpt-4.1-mini-20250929", weight: 1.0, description: "Base model" }
  ],
  RETRIEVER: [
    { version: "gpt-4o-20250929", weight: 1.0, description: "GPT-4o base model" }
  ],
  GUARDRAIL: [
    { version: "gpt-4.1-mini-20250929", weight: 1.0, description: "Base model" }
  ]
}

/**
 * Current model versions for each agent type (backward compatibility)
 * Returns the first (primary) version from the registry
 */
export const CURRENT_MODELS: Record<AgentType, string> = {
  FILER: MODEL_REGISTRY.FILER[0]?.version || "unknown",
  LIBRARIAN: MODEL_REGISTRY.LIBRARIAN[0]?.version || "unknown",
  PRIORITIZER: MODEL_REGISTRY.PRIORITIZER[0]?.version || "unknown",
  STORER: MODEL_REGISTRY.STORER[0]?.version || "unknown",
  RETRIEVER: MODEL_REGISTRY.RETRIEVER[0]?.version || "unknown",
  GUARDRAIL: MODEL_REGISTRY.GUARDRAIL[0]?.version || "unknown"
}

/**
 * Get the current model version for an agent type (backward compatibility)
 * Returns the primary version (first in registry)
 * For A/B testing, use getRandomModelVersion() instead
 * @param agentType The agent type to get the model version for
 * @returns The model version string (e.g., "gpt-4.1-mini-20250929" or "ocd-prioritizer-v2")
 */
export function getModelVersion(agentType: AgentType): string {
  return CURRENT_MODELS[agentType] || "unknown"
}

/**
 * Get model version for an agent (supports A/B testing)
 * If A/B testing is enabled, returns a random version based on weights
 * Otherwise, returns the primary version
 * @param agentType The agent type
 * @param useABTesting Whether to use A/B testing (default: false for backward compatibility)
 * @returns The model version string
 */
export function getModelVersionForAgent(
  agentType: AgentType,
  useABTesting: boolean = false
): string {
  if (useABTesting && isABTestingEnabled(agentType)) {
    return getRandomModelVersion(agentType)
  }
  return getModelVersion(agentType)
}

/**
 * Get a random model version for A/B testing
 * Uses weighted random selection based on configured weights
 * @param agentType The agent type to get a model version for
 * @returns A randomly selected model version based on weights
 */
export function getRandomModelVersion(agentType: AgentType): string {
  const versions = MODEL_REGISTRY[agentType]
  
  if (!versions || versions.length === 0) {
    return "unknown"
  }

  // If only one version, return it
  if (versions.length === 1) {
    return versions[0].version
  }

  // Calculate total weight
  const totalWeight = versions.reduce((sum, v) => sum + v.weight, 0)
  
  if (totalWeight === 0) {
    // Fallback to equal weights
    const randomIndex = Math.floor(Math.random() * versions.length)
    return versions[randomIndex].version
  }

  // Weighted random selection
  let random = Math.random() * totalWeight
  for (const config of versions) {
    random -= config.weight
    if (random <= 0) {
      return config.version
    }
  }

  // Fallback (shouldn't happen)
  return versions[versions.length - 1].version
}

/**
 * Get all available model versions for an agent type
 * @param agentType The agent type
 * @returns Array of model version configurations
 */
export function getAvailableVersions(agentType: AgentType): ModelVersionConfig[] {
  return MODEL_REGISTRY[agentType] || []
}

/**
 * Check if A/B testing is enabled for an agent type
 * (i.e., has more than one version configured)
 * @param agentType The agent type to check
 * @returns True if multiple versions are available
 */
export function isABTestingEnabled(agentType: AgentType): boolean {
  const versions = MODEL_REGISTRY[agentType]
  return versions ? versions.length > 1 : false
}

/**
 * Check if a model version is a fine-tuned model (starts with "ocd-")
 * @param modelVersion The model version string to check
 * @returns True if it's a fine-tuned model
 */
export function isFineTunedModel(modelVersion: string): boolean {
  return modelVersion.startsWith("ocd-")
}
