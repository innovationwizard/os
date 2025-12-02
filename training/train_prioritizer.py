#!/usr/bin/env python3
"""
Train AI Prioritizer agent using PPO on M1 Mac

Usage:
    python train_prioritizer.py --data training/data/prioritizer.jsonl --epochs 3 --batch-size 4
"""
import os
import sys
import argparse
import json
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import PPOTrainer, PPOConfig, AutoModelForCausalLMWithValueHead
from peft import LoraConfig, get_peft_model
from dotenv import load_dotenv

load_dotenv()

def load_training_data(filepath: str):
    """Load training data from JSONL file"""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Training data file not found: {filepath}")
    
    training_examples = []
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                training_examples.append(json.loads(line))
    
    print(f"✅ Loaded {len(training_examples)} training examples from {filepath}")
    return training_examples

def setup_model_and_tokenizer(model_name: str, use_quantization: bool = True):
    """Setup model with quantization and LoRA for M1"""
    print(f"🤖 Loading model: {model_name}")
    
    # Check device
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"   Using device: {device}")
    
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id
    
    # Quantization config for M1
    quantization_config = None
    if use_quantization:
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4"
        )
        print("   Using 4-bit quantization")
    
    # Load base model
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=quantization_config,
        device_map="auto" if device.type != "cpu" else None,
        torch_dtype=torch.float16 if quantization_config is None else None,
        trust_remote_code=True
    )
    
    # Add LoRA adapters
    print("   Adding LoRA adapters...")
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"]  # Llama attention modules
    )
    
    model = get_peft_model(model, lora_config)
    
    # Wrap with value head for PPO
    model = AutoModelForCausalLMWithValueHead.from_pretrained(model)
    
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"   Trainable parameters: {trainable_params:,} / {total_params:,} ({100 * trainable_params / total_params:.2f}%)")
    
    return model, tokenizer

def train_ppo(
    model,
    tokenizer,
    training_data: list,
    output_dir: str,
    epochs: int = 3,
    batch_size: int = 4,
    learning_rate: float = 1.41e-5
):
    """Train model using PPO"""
    print(f"\n🚀 Starting PPO training...")
    print(f"   Training examples: {len(training_data)}")
    print(f"   Epochs: {epochs}")
    print(f"   Batch size: {batch_size}")
    print(f"   Learning rate: {learning_rate}")
    
    # PPO Config
    ppo_config = PPOConfig(
        model_name="ocd-prioritizer-v1",
        learning_rate=learning_rate,
        batch_size=batch_size,
        mini_batch_size=1,
        gradient_accumulation_steps=4,
        optimize_cuda_cache=False,  # Not needed for MPS
        seed=42,
        log_with=None  # Set to "wandb" if you want logging
    )
    
    # Initialize PPO Trainer
    ppo_trainer = PPOTrainer(
        config=ppo_config,
        model=model,
        tokenizer=tokenizer,
    )
    
    # Training loop
    for epoch in range(epochs):
        print(f"\n📊 Epoch {epoch + 1}/{epochs}")
        
        epoch_rewards = []
        
        # Process in batches
        for i in range(0, len(training_data), batch_size):
            batch = training_data[i:i + batch_size]
            
            # Extract prompts and rewards
            queries = [ex["prompt"] for ex in batch]
            rewards = [ex["reward"] for ex in batch]
            
            # Tokenize queries
            query_tensors = []
            for query in queries:
                tokens = tokenizer(
                    query,
                    return_tensors="pt",
                    truncation=True,
                    max_length=1024  # Longer context for prioritizer
                )
                query_tensors.append(tokens.input_ids.squeeze())
            
            # Generate responses
            response_tensors = []
            for query_tensor in query_tensors:
                with torch.no_grad():
                    response = ppo_trainer.generate(
                        query_tensor.unsqueeze(0),
                        max_new_tokens=256,  # Longer responses for prioritizer
                        do_sample=True,
                        top_k=50,
                        top_p=0.95,
                        temperature=0.7,
                        return_prompt=False
                    )
                    # Extract generated tokens (remove prompt)
                    generated_tokens = response.squeeze()[query_tensor.shape[0]:]
                    response_tensors.append(generated_tokens)
            
            # Decode responses for logging
            responses = [tokenizer.decode(r, skip_special_tokens=True) for r in response_tensors]
            
            # PPO step
            stats = ppo_trainer.step(query_tensors, response_tensors, rewards)
            
            avg_reward = sum(rewards) / len(rewards)
            epoch_rewards.append(avg_reward)
            
            if (i // batch_size) % 10 == 0:
                print(f"   Batch {i // batch_size + 1}: Avg Reward = {avg_reward:.3f}")
                if responses:
                    print(f"   Sample: {responses[0][:80]}...")
        
        avg_epoch_reward = sum(epoch_rewards) / len(epoch_rewards)
        print(f"✅ Epoch {epoch + 1} complete. Average reward: {avg_epoch_reward:.3f}")
        
        # Save checkpoint
        checkpoint_dir = os.path.join(output_dir, f"checkpoint-epoch-{epoch + 1}")
        os.makedirs(checkpoint_dir, exist_ok=True)
        model.save_pretrained(checkpoint_dir)
        tokenizer.save_pretrained(checkpoint_dir)
        print(f"💾 Saved checkpoint to {checkpoint_dir}")
    
    # Save final model
    print(f"\n💾 Saving final model to {output_dir}...")
    os.makedirs(output_dir, exist_ok=True)
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"✅ Training complete! Model saved to {output_dir}")

def main():
    parser = argparse.ArgumentParser(description="Train AI Prioritizer agent with PPO on M1")
    parser.add_argument("--data", required=True, help="Path to training data JSONL file")
    parser.add_argument("--output", default="./models/ocd-prioritizer-v1", help="Output directory for model")
    parser.add_argument("--model", default="meta-llama/Llama-3.1-8B-Instruct", help="Base model name")
    parser.add_argument("--epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=4, help="Batch size")
    parser.add_argument("--learning-rate", type=float, default=1.41e-5, help="Learning rate")
    parser.add_argument("--no-quantization", action="store_true", help="Disable 4-bit quantization")
    
    args = parser.parse_args()
    
    # Check MPS availability
    if torch.backends.mps.is_available():
        print("✅ MPS (Metal GPU) is available")
    else:
        print("⚠️  MPS not available, using CPU (will be slow)")
    
    # Load training data
    print(f"\n📥 Loading training data...")
    training_data = load_training_data(args.data)
    
    if len(training_data) == 0:
        print("❌ No training data found!")
        sys.exit(1)
    
    # Check data format
    if "prompt" not in training_data[0] or "reward" not in training_data[0]:
        print("❌ Invalid training data format. Expected 'prompt' and 'reward' fields.")
        sys.exit(1)
    
    # Setup model
    print(f"\n🤖 Setting up model...")
    model, tokenizer = setup_model_and_tokenizer(
        args.model,
        use_quantization=not args.no_quantization
    )
    
    # Train
    train_ppo(
        model,
        tokenizer,
        training_data,
        args.output,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate
    )

if __name__ == "__main__":
    main()
