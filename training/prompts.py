"""
Prompt formatting for each agent type
"""
import json
from typing import Dict, Any
from training.database import DecisionRecord

# System prompts (should match src/lib/ai.ts)
FILER_SYSTEM_PROMPT = """You are the "Filer" AI for a personal project management system (OCD - Opus Corpus Documenter). Your job is to act as a natural language parser.
You will be given the human's original Instructions, any supplemental routing notes, the project this item was routed to,
and the list of all known projects.

Return a single JSON object with the keys: "swimlane", "priority", "labels", "urgency", "reasoning", and "confidence".

Rules:
1. swimlane (string):
   - "Expedite": if instructions imply urgency, external interrupt, bug, stakeholder request, or "wife" task.
   - "Home": if instructions imply a domestic or personal errand.
   - "Habit": if instructions imply a recurring personal development task (study, content creation, etc.).
   - "Project": default for standard project-related work.
2. priority (string):
   - "High" if swimlane is "Expedite" or "Home".
   - "Medium" if swimlane is "Project".
   - "Low" if swimlane is "Habit".
3. labels (array of strings):
   - Add "Job 1 (Income)" if instructions reference Latina, AI Refill, IngePro, Tragaldabas, or Candidatos.
   - Add "Job 2 (Authority)" if instructions reference Portfolio, GitHub Green, Data Science, or Content Creation.
   - Add the matching project name if instructions reference a known project.
4. urgency (string):
   - Must be either "To Do" or "On Hold". Pick "To Do" for items that should move forward immediately; otherwise "On Hold".
5. reasoning (string):
   - Provide a clear, concise explanation of why you made this classification. Include specific keywords or patterns from the instructions that led to your decision.
6. confidence (number):
   - A value between 0.0 and 1.0 indicating how confident you are in this classification.

You must return only the raw JSON object. Do not include Markdown, commentary, or additional text."""

LIBRARIAN_SYSTEM_PROMPT = """You are an AI Project Analyst. Your job is to analyze a new, incoming task (New_Item) against its surrounding context,
which includes the project's strategic goals (Strategic_Context) and all other existing tasks in the same project (Corpus).

Look for Conflicts, Dependencies, Relations, Redundancies, or Suggestions as defined:
1. Conflict: New item violates a strategic goal.
2. Redundancy: New item duplicates existing work.
3. Relation: New item is logically related to other items.
4. Dependency: New item depends on another item being completed first.
5. Suggestion: Any actionable insight that helps clarify next steps.

Return only a JSON array. Each element must have "type" (Conflict | Dependency | Redundancy | Relation | Suggestion)
and "text" (brief, direct explanation).

If you find nothing, return [].

You must return only the raw JSON array. Do not include Markdown, commentary, or additional text."""

PRIORITIZER_SYSTEM_PROMPT = """You are the "Prioritizer" AI for a personal project management system. Your job is to select the next Item to work on from all available TODO items.

You will be given:
- All TODO items (with their swimlane, priority, labels, age, and context)
- Current context (time of day, recent work patterns)
- Strategic goals (monetization, portfolio building, authority building)
- External constraints (deadlines, stakeholder expectations)

Return a single JSON object with:
- "recommended_item_id": The ID of the Item to pull to CREATING
- "confidence": A value between 0.0 and 1.0 indicating confidence
- "reasoning": Clear explanation of why this Item should be worked on now

Consider:
1. Strategic alignment (Job 1 Income vs Job 2 Authority)
2. Urgency vs Importance balance
3. Energy/time of day matching
4. Dependencies and blockers
5. Recent work patterns (avoid context switching)

You must return only the raw JSON object. Do not include Markdown, commentary, or additional text."""

def format_filer_prompt(state: Dict[str, Any]) -> str:
    """Format Filer prompt from state"""
    item = state.get("item", {})
    assigned_opus = state.get("assignedOpus")
    available_opuses = state.get("availableOpuses", [])
    
    prompt = f"""Instructions: {item.get('rawInstructions', '')}
Routing Notes: {item.get('routingNotes', 'None')}
Item Title: {item.get('title', '')}

"""
    
    if assigned_opus:
        prompt += f"""Assigned Project:
- Name: {assigned_opus.get('name', '')}
- Type: {assigned_opus.get('opusType', '')}
- Content: {assigned_opus.get('content', '')[:500]}...

"""
    
    if available_opuses:
        prompt += "Available Projects:\n"
        for opus in available_opuses[:10]:  # Limit to 10
            prompt += f"- {opus.get('name', '')} ({opus.get('opusType', '')})\n"
    
    return prompt.strip()

def format_librarian_prompt(state: Dict[str, Any]) -> str:
    """Format Librarian prompt from state"""
    new_item = state.get("newItem", {})
    opus = state.get("opus", {})
    corpus = state.get("corpus", [])
    
    prompt = f"""New Item:
- Title: {new_item.get('title', '')}
- Instructions: {new_item.get('rawInstructions', '')}
- Routing Notes: {new_item.get('routingNotes', 'None')}

Project Context:
- Name: {opus.get('name', '')}
- Strategic: {opus.get('isStrategic', False)}
- Content: {opus.get('content', '')[:1000]}...

Existing Items in Project ({len(corpus)} items):
"""
    
    for item in corpus[:20]:  # Limit to 20
        prompt += f"- [{item.get('status', '')}] {item.get('title', '')}: {item.get('rawInstructions', '')[:100]}...\n"
    
    return prompt.strip()

def format_prioritizer_prompt(state: Dict[str, Any]) -> str:
    """Format Prioritizer prompt from state"""
    available_items = state.get("availableItems", [])
    user_context = state.get("userContext", {})
    strategic_state = state.get("strategicState", {})
    constraints = state.get("constraints", {})
    
    prompt = f"""Available TODO Items ({len(available_items)} items):

"""
    
    for item in available_items[:20]:  # Limit to 20
        prompt += f"""- ID: {item.get('id', '')}
  Title: {item.get('title', '')}
  Swimlane: {item.get('swimlane', '')}
  Priority: {item.get('priority', '')}
  Labels: {', '.join(item.get('labels', []))}
  Age: {item.get('statusChangedAt', 'Unknown')}

"""
    
    prompt += f"""
User Context:
- Current Time: {user_context.get('currentTime', 'Unknown')}
- Day of Week: {user_context.get('dayOfWeek', 'Unknown')}
- Current Focus: {user_context.get('currentFocus', 'None')}

Strategic State:
- Income Goal Progress: {strategic_state.get('incomeGoalProgress', 0):.1%}
- Authority Goal Progress: {strategic_state.get('authorityGoalProgress', 0):.1%}

Constraints:
- WIP Count: {constraints.get('wipCount', 0)}
- Blocked Count: {constraints.get('blockedCount', 0)}
- Average Cycle Time: {constraints.get('averageCycleTime', 0):.1f} days
"""
    
    return prompt.strip()

def format_prompt_for_agent(agent_type: str, state: Dict[str, Any]) -> str:
    """Format prompt based on agent type"""
    if agent_type == "FILER":
        return format_filer_prompt(state)
    elif agent_type == "LIBRARIAN":
        return format_librarian_prompt(state)
    elif agent_type == "PRIORITIZER":
        return format_prioritizer_prompt(state)
    else:
        # Generic format
        return json.dumps(state, indent=2)

def get_system_prompt(agent_type: str) -> str:
    """Get system prompt for agent type"""
    prompts = {
        "FILER": FILER_SYSTEM_PROMPT,
        "LIBRARIAN": LIBRARIAN_SYSTEM_PROMPT,
        "PRIORITIZER": PRIORITIZER_SYSTEM_PROMPT,
    }
    return prompts.get(agent_type, "")
