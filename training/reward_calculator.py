"""
Reward calculation for training data
This matches the reward calculation logic from src/lib/reward-calculator.ts
"""
from typing import Dict, Any, Optional
from training.database import DecisionRecord

def calculate_reward_from_record(record: DecisionRecord) -> float:
    """
    Calculate reward from a DecisionRecord
    
    Uses the stored reward if available, otherwise calculates from components
    """
    if record.reward is not None:
        return record.reward
    
    # If we have reward components, calculate from them
    if record.reward_components:
        return calculate_reward_from_components(
            record.agent_type,
            record.reward_components
        )
    
    # Fallback: simple reward based on user feedback
    if record.user_feedback == "CONFIRMED":
        return 1.0
    elif record.user_feedback == "CORRECTED":
        return -0.5
    elif record.user_feedback == "OVERRIDDEN":
        return -0.8
    elif record.user_feedback == "IGNORED":
        return 0.0
    
    return 0.0

def calculate_reward_from_components(
    agent_type: str,
    components: Dict[str, Any]
) -> float:
    """
    Calculate total reward from reward components using weights
    
    This matches the logic in src/lib/reward-calculator.ts
    """
    # Reward weights (should match REWARD_WEIGHTS in reward-calculator.ts)
    weights = {
        "FILER": {
            "immediate": {"userFeedback": 1.0, "confidenceCalibration": 0.1},
            "delayed": {
                "completionSuccess": 0.5,
                "blockageAvoidance": 0.3,
                "reworkPenalty": 0.2,
                "timeEfficiency": 0.3
            },
            "strategic": {"goalAlignment": 0.4, "opportunityCost": 0.2}
        },
        "LIBRARIAN": {
            "immediate": {"userFeedback": 1.0},
            "delayed": {
                "conflictPrevention": 2.0,
                "falsePositivePenalty": 0.5,
                "missedIssuePenalty": 2.0,
                "dependencyAccuracy": 0.5
            }
        },
        "PRIORITIZER": {
            "immediate": {"userAcceptance": 1.0},
            "delayed": {
                "completionSuccess": 1.0,
                "timeEfficiency": 0.5,
                "strategicProgress": 0.8,
                "opportunityCost": 0.3
            },
            "contextual": {"energyAlignment": 0.2, "flowMaintenance": 0.2}
        },
        "STORER": {
            "immediate": {"userAcceptance": 1.0, "editDistance": 0.5},
            "delayed": {
                "corpusCoherence": 0.7,
                "findability": 0.6,
                "duplicationPenalty": 0.4
            }
        },
        "RETRIEVER": {
            "immediate": {"userAcceptance": 1.0, "editDistance": 0.5},
            "accuracy": {
                "citationCorrectness": 0.8,
                "hallucinationPenalty": 2.0,
                "completeness": 0.6
            },
            "quality": {"coherence": 0.4, "styleAlignment": 0.3}
        }
    }
    
    agent_weights = weights.get(agent_type, {})
    total_reward = 0.0
    
    def traverse(obj: Dict[str, Any], prefix: str = "") -> None:
        nonlocal total_reward
        for key, value in obj.items():
            path = f"{prefix}.{key}" if prefix else key
            
            if isinstance(value, (int, float)):
                # Get weight for this component
                weight = get_nested_weight(agent_weights, path)
                total_reward += weight * value
            elif isinstance(value, dict):
                traverse(value, path)
    
    traverse(components)
    
    # Clamp to reasonable range
    return max(-5.0, min(5.0, total_reward))

def get_nested_weight(weights: Dict[str, Any], path: str) -> float:
    """Get nested weight value from path"""
    parts = path.split(".")
    current = weights
    
    for part in parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return 0.0
    
    return float(current) if isinstance(current, (int, float)) else 0.0

def normalize_reward(reward: float, min_reward: float = -2.0, max_reward: float = 2.0) -> float:
    """Normalize reward to [0, 1] range for training"""
    return (reward - min_reward) / (max_reward - min_reward)
