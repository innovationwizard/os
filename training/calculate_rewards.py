#!/usr/bin/env python3
"""
Calculate rewards for decisions that don't have them yet

This script calls the reward calculation API or calculates rewards directly
"""
import os
import sys
import requests
from typing import List
from dotenv import load_dotenv

from training.database import load_training_decisions, DecisionRecord
from training.reward_calculator import calculate_reward_from_record

load_dotenv()

def calculate_rewards_via_api(decision_ids: List[str], api_url: str = "http://localhost:3000"):
    """Calculate rewards via API endpoint"""
    url = f"{api_url}/api/training/decisions"
    
    response = requests.post(
        url,
        json={"decisionIds": decision_ids},
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Calculated rewards for {result.get('updated', 0)} decisions")
        return result
    else:
        print(f"❌ API error: {response.status_code} - {response.text}")
        return None

def calculate_rewards_directly(decisions: List[DecisionRecord]):
    """Calculate rewards directly (for testing)"""
    from training.database import get_database_connection
    from sqlalchemy import text
    
    engine = get_database_connection()
    updated = 0
    
    for decision in decisions:
        if decision.reward is not None:
            continue  # Already has reward
        
        # Calculate reward
        reward = calculate_reward_from_record(decision)
        
        # Update database
        with engine.connect() as conn:
            conn.execute(
                text("""
                    UPDATE "Decision"
                    SET reward = :reward,
                        "rewardComputedAt" = NOW()
                    WHERE id = :id
                """),
                {"id": decision.id, "reward": reward}
            )
            conn.commit()
        
        updated += 1
    
    return updated

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Calculate rewards for decisions")
    parser.add_argument("--agent-type", default="FILER", help="Agent type")
    parser.add_argument("--max-samples", type=int, default=1000, help="Max samples to process")
    parser.add_argument("--use-api", action="store_true", help="Use API endpoint")
    parser.add_argument("--api-url", default="http://localhost:3000", help="API URL")
    
    args = parser.parse_args()
    
    print(f"📊 Loading decisions for {args.agent_type}...")
    decisions = load_training_decisions(
        agent_type=args.agent_type,
        max_samples=args.max_samples,
        require_reward=False  # Get all decisions
    )
    
    # Filter to only those without rewards
    decisions_without_rewards = [d for d in decisions if d.reward is None]
    
    print(f"   Total decisions: {len(decisions)}")
    print(f"   Without rewards: {len(decisions_without_rewards)}")
    
    if len(decisions_without_rewards) == 0:
        print("✅ All decisions already have rewards!")
        return
    
    if args.use_api:
        print(f"🌐 Calculating rewards via API...")
        decision_ids = [d.id for d in decisions_without_rewards]
        result = calculate_rewards_via_api(decision_ids, args.api_url)
        if result:
            print(f"✅ Updated {result.get('updated', 0)} decisions")
    else:
        print(f"🔢 Calculating rewards directly...")
        updated = calculate_rewards_directly(decisions_without_rewards)
        print(f"✅ Updated {updated} decisions")

if __name__ == "__main__":
    main()
