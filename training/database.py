"""
Database utilities for loading training data from Decision table
"""
import os
import json
from typing import List, Dict, Optional
from dataclasses import dataclass
import psycopg2
from psycopg2.extras import RealDictCursor
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

@dataclass
class DecisionRecord:
    """Decision record from database"""
    id: str
    agent_type: str
    state: dict
    action: dict
    reward: Optional[float]
    reward_components: Optional[dict]
    confidence: Optional[float]
    reasoning: Optional[str]
    user_feedback: Optional[str]
    user_correction: Optional[dict]
    outcome_metrics: Optional[dict]
    item_id: Optional[str]
    opus_id: Optional[str]
    model_version: str
    created_at: str

def get_database_connection() -> Engine:
    """Create database connection"""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    # Convert postgres:// to postgresql:// for SQLAlchemy
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    # Add connection pool settings for better performance
    return create_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )

def load_training_decisions(
    agent_type: str,
    max_samples: int = 1000,
    require_reward: bool = True,
    require_feedback: bool = False,
    min_reward: float = -2.0,
    is_training_data: bool = True
) -> List[DecisionRecord]:
    """
    Load training decisions from Decision table
    
    Args:
        agent_type: Agent type (FILER, LIBRARIAN, etc.)
        max_samples: Maximum number of samples to load
        require_reward: Only load decisions with calculated rewards
        require_feedback: Only load decisions with user feedback
        min_reward: Minimum reward threshold
        is_training_data: Only load decisions marked as training data
    
    Returns:
        List of DecisionRecord objects
    """
    engine = get_database_connection()
    
    query = text("""
        SELECT 
            d.id,
            d."agentType" as agent_type,
            d.state,
            d.action,
            d.reward,
            d."rewardComponents" as reward_components,
            d.confidence,
            d.reasoning,
            d."userFeedback" as user_feedback,
            d."userCorrection" as user_correction,
            d."outcomeMetrics" as outcome_metrics,
            d."itemId" as item_id,
            d."opusId" as opus_id,
            d."modelVersion" as model_version,
            d."createdAt" as created_at
        FROM "Decision" d
        WHERE d."agentType" = :agent_type
          AND d."isTrainingData" = :is_training_data
    """)
    
    params = {
        "agent_type": agent_type,
        "is_training_data": is_training_data
    }
    
    if require_reward:
        query = text(str(query).replace(
            "WHERE d.\"agentType\" = :agent_type",
            "WHERE d.\"agentType\" = :agent_type AND d.reward IS NOT NULL"
        ))
        query = text(str(query).replace(
            "AND d.\"isTrainingData\" = :is_training_data",
            "AND d.\"isTrainingData\" = :is_training_data AND d.reward >= :min_reward"
        ))
        params["min_reward"] = min_reward
    
    if require_feedback:
        query = text(str(query).replace(
            "AND d.reward >= :min_reward",
            "AND d.reward >= :min_reward AND d.\"userFeedback\" IS NOT NULL"
        ))
    
    query = text(str(query) + "\nORDER BY d.\"createdAt\" DESC\nLIMIT :max_samples")
    params["max_samples"] = max_samples
    
    with engine.connect() as conn:
        result = conn.execute(query, params)
        rows = result.fetchall()
    
    decisions = []
    for row in rows:
        decisions.append(DecisionRecord(
            id=row[0],
            agent_type=row[1],
            state=row[2] if isinstance(row[2], dict) else json.loads(row[2]) if row[2] else {},
            action=row[3] if isinstance(row[3], dict) else json.loads(row[3]) if row[3] else {},
            reward=float(row[4]) if row[4] is not None else None,
            reward_components=row[5] if isinstance(row[5], dict) else json.loads(row[5]) if row[5] else None,
            confidence=float(row[6]) if row[6] is not None else None,
            reasoning=row[7],
            user_feedback=row[8],
            user_correction=row[9] if isinstance(row[9], dict) else json.loads(row[9]) if row[9] else None,
            outcome_metrics=row[10] if isinstance(row[10], dict) else json.loads(row[10]) if row[10] else None,
            item_id=row[11],
            opus_id=row[12],
            model_version=row[13],
            created_at=row[14].isoformat() if hasattr(row[14], 'isoformat') else str(row[14])
        ))
    
    return decisions

def get_training_stats(agent_type: str) -> Dict:
    """Get statistics about available training data"""
    engine = get_database_connection()
    
    query = text("""
        SELECT 
            COUNT(*) as total_decisions,
            COUNT(CASE WHEN reward IS NOT NULL THEN 1 END) as decisions_with_reward,
            COUNT(CASE WHEN "userFeedback" IS NOT NULL THEN 1 END) as decisions_with_feedback,
            AVG(reward) as avg_reward,
            MIN(reward) as min_reward,
            MAX(reward) as max_reward,
            COUNT(CASE WHEN "isTrainingData" = true THEN 1 END) as training_data_count,
            COUNT(CASE WHEN "isValidationData" = true THEN 1 END) as validation_data_count
        FROM "Decision"
        WHERE "agentType" = :agent_type
    """)
    
    with engine.connect() as conn:
        result = conn.execute(query, {"agent_type": agent_type})
        row = result.fetchone()
    
    return {
        "total_decisions": row[0],
        "decisions_with_reward": row[1],
        "decisions_with_feedback": row[2],
        "avg_reward": float(row[3]) if row[3] else None,
        "min_reward": float(row[4]) if row[4] else None,
        "max_reward": float(row[5]) if row[5] else None,
        "training_data_count": row[6],
        "validation_data_count": row[7]
    }
