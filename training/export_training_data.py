#!/usr/bin/env python3
"""
Export training data from Decision table for M1 training

Usage:
    python export_training_data.py --agent-type FILER --output training/data/filer.jsonl --limit 1000
"""
import os
import sys
import argparse
import json
from dotenv import load_dotenv

from training.database import load_training_decisions
from training.prompts import format_prompt_for_agent, get_system_prompt

load_dotenv()

def export_training_data(agent_type: str, output_path: str, limit: int = 1000, min_reward: float = -2.0, require_feedback: bool = False):
    """Export training data to JSONL file"""
    
    print(f"📊 Loading training decisions for {agent_type}...")
    decisions = load_training_decisions(
        agent_type=agent_type,
        max_samples=limit,
        require_reward=True,
        require_feedback=require_feedback,
        min_reward=min_reward
    )
    
    print(f"   Loaded {len(decisions)} decisions")
    
    if len(decisions) == 0:
        print("❌ No training data found!")
        sys.exit(1)
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Format training examples
    training_examples = []
    
    for decision in decisions:
        # Format prompt
        prompt = format_prompt_for_agent(agent_type, decision.state)
        
        # Format completion from action
        completion = json.dumps(decision.action)
        
        # Create training example
        example = {
            "prompt": prompt,
            "completion": completion,
            "reward": decision.reward or 0.0,
            "confidence": decision.confidence,
            "metadata": {
                "decisionId": decision.id,
                "itemId": decision.item_id,
                "opusId": decision.opus_id,
                "userFeedback": decision.user_feedback,
                "rewardComponents": decision.reward_components,
                "createdAt": decision.created_at
            }
        }
        
        training_examples.append(example)
    
    # Write JSONL file
    print(f"💾 Writing {len(training_examples)} examples to {output_path}...")
    with open(output_path, 'w') as f:
        for example in training_examples:
            f.write(json.dumps(example) + '\n')
    
    # Calculate statistics
    rewards = [ex["reward"] for ex in training_examples if ex["reward"] is not None]
    avg_reward = sum(rewards) / len(rewards) if rewards else 0.0
    confirmed_count = sum(1 for ex in training_examples if ex["metadata"]["userFeedback"] == "CONFIRMED")
    corrected_count = sum(1 for ex in training_examples if ex["metadata"]["userFeedback"] == "CORRECTED")
    
    print(f"\n✅ Export complete!")
    print(f"   Examples: {len(training_examples)}")
    print(f"   Average reward: {avg_reward:.3f}")
    print(f"   Reward range: [{min(rewards):.3f}, {max(rewards):.3f}]" if rewards else "   Reward range: N/A")
    print(f"   Confirmed: {confirmed_count}/{len(training_examples)} ({100 * confirmed_count / len(training_examples):.1f}%)")
    print(f"   Corrected: {corrected_count}/{len(training_examples)} ({100 * corrected_count / len(training_examples):.1f}%)")
    
    return {
        "count": len(training_examples),
        "avg_reward": avg_reward,
        "confirmed_count": confirmed_count,
        "corrected_count": corrected_count
    }

def main():
    parser = argparse.ArgumentParser(description="Export training data for RL training")
    parser.add_argument("--agent-type", required=True, choices=["FILER", "LIBRARIAN", "PRIORITIZER", "STORER", "RETRIEVER"], help="Agent type")
    parser.add_argument("--output", required=True, help="Output JSONL file path")
    parser.add_argument("--limit", type=int, default=1000, help="Maximum number of examples")
    parser.add_argument("--min-reward", type=float, default=-2.0, help="Minimum reward threshold")
    parser.add_argument("--require-feedback", action="store_true", help="Require user feedback")
    
    args = parser.parse_args()
    
    export_training_data(
        agent_type=args.agent_type,
        output_path=args.output,
        limit=args.limit,
        min_reward=args.min_reward,
        require_feedback=args.require_feedback
    )

if __name__ == "__main__":
    main()
