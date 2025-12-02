"""
Configuration for RL training on M1 Mac
"""
import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class TrainingConfig:
    """Training configuration"""
    # Model settings
    model_name: str = "meta-llama/Llama-3.1-8B-Instruct"  # or "mistralai/Mistral-7B-Instruct-v0.3"
    use_quantization: bool = True  # 4-bit quantization for M1
    load_in_4bit: bool = True
    torch_dtype: str = "float16"
    
    # LoRA settings
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.05
    
    # PPO settings
    learning_rate: float = 1.41e-5
    batch_size: int = 4  # Small for M1
    mini_batch_size: int = 1
    gradient_accumulation_steps: int = 4
    max_new_tokens: int = 128
    num_epochs: int = 3
    
    # Data settings
    max_training_samples: int = 1000
    require_reward: bool = True
    require_feedback: bool = False
    min_reward: float = -2.0
    
    # Output settings
    output_dir: str = "./models"
    save_steps: int = 100
    logging_steps: int = 10
    
    # Device
    device: Optional[str] = None  # Auto-detect (mps/cpu)
    
    # Database
    database_url: Optional[str] = None  # From env
    
    def __post_init__(self):
        """Set defaults from environment"""
        import torch
        
        # Auto-detect device
        if self.device is None:
            if torch.backends.mps.is_available():
                self.device = "mps"
            elif torch.cuda.is_available():
                self.device = "cuda"
            else:
                self.device = "cpu"
        
        # Database URL from environment
        if self.database_url is None:
            self.database_url = os.getenv("DATABASE_URL")
        
        # Model output directory
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir, exist_ok=True)

@dataclass
class AgentConfig:
    """Agent-specific configuration"""
    agent_type: str  # FILER, LIBRARIAN, etc.
    model_name: str
    output_dir: str
    
    def __init__(self, agent_type: str, base_config: TrainingConfig):
        self.agent_type = agent_type
        self.model_name = f"ocd-{agent_type.lower()}-v1"
        self.output_dir = os.path.join(base_config.output_dir, self.model_name)
