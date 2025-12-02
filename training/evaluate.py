#!/usr/bin/env python3
"""
Evaluate trained model performance

Usage:
    python evaluate.py --model models/ocd-filer-v1 --test-data training/data/filer-test.jsonl
"""
import os
import sys
import argparse
import json
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel
from dotenv import load_dotenv
from typing import List, Dict, Any
import numpy as np

load_dotenv()

def load_test_data(filepath: str) -> List[Dict[str, Any]]:
    """Load test data from JSONL file"""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Test data file not found: {filepath}")
    
    test_examples = []
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                test_examples.append(json.loads(line))
    
    print(f"✅ Loaded {len(test_examples)} test examples from {filepath}")
    return test_examples

def load_model(model_path: str, base_model: str = None, use_quantization: bool = True):
    """Load trained model"""
    print(f"🤖 Loading model from: {model_path}")
    
    # Check device
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"   Using device: {device}")
    
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id
    
    # Determine base model
    if base_model is None:
        # Try to infer from config
        config_path = os.path.join(model_path, "adapter_config.json")
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                adapter_config = json.load(f)
                base_model = adapter_config.get("base_model_name_or_path", "meta-llama/Llama-3.1-8B-Instruct")
        else:
            base_model = "meta-llama/Llama-3.1-8B-Instruct"
    
    print(f"   Base model: {base_model}")
    
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
    base_model_obj = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=quantization_config,
        device_map="auto" if device.type != "cpu" else None,
        torch_dtype=torch.float16 if quantization_config is None else None,
        trust_remote_code=True
    )
    
    # Check if LoRA adapters exist
    adapter_path = os.path.join(model_path, "adapter_model.bin")
    if os.path.exists(adapter_path) or os.path.exists(os.path.join(model_path, "adapter_model.safetensors")):
        print("   Loading LoRA adapters...")
        model = PeftModel.from_pretrained(base_model_obj, model_path)
    else:
        print("   No LoRA adapters found, using base model")
        model = base_model_obj
    
    model.eval()
    return model, tokenizer

def generate_response(model, tokenizer, prompt: str, max_new_tokens: int = 256) -> str:
    """Generate response from model"""
    # Tokenize input
    inputs = tokenizer(
        prompt,
        return_tensors="pt",
        truncation=True,
        max_length=1024
    )
    
    # Move to device
    device = next(model.parameters()).device
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    # Generate
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=True,
            top_k=50,
            top_p=0.95,
            temperature=0.7,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id
        )
    
    # Decode response (remove prompt)
    generated_tokens = outputs[0][inputs["input_ids"].shape[1]:]
    response = tokenizer.decode(generated_tokens, skip_special_tokens=True)
    
    return response

def parse_filer_response(response: str) -> Dict[str, Any]:
    """Parse Filer agent response (JSON)"""
    try:
        # Try to extract JSON from response
        import re
        json_match = re.search(r'\{[^}]+\}', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(response)
    except:
        return {"error": "Failed to parse JSON", "raw": response}

def parse_prioritizer_response(response: str) -> Dict[str, Any]:
    """Parse Prioritizer agent response (JSON)"""
    try:
        import re
        json_match = re.search(r'\{[^}]+\}', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(response)
    except:
        return {"error": "Failed to parse JSON", "raw": response}

def evaluate_filer(model, tokenizer, test_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Evaluate Filer agent"""
    print("\n📊 Evaluating Filer agent...")
    
    correct = 0
    total = 0
    rewards = []
    errors = []
    
    for i, example in enumerate(test_data):
        prompt = example["prompt"]
        expected = example.get("completion", {})
        expected_reward = example.get("reward", 0.0)
        
        # Generate response
        response_text = generate_response(model, tokenizer, prompt, max_new_tokens=128)
        parsed = parse_filer_response(response_text)
        
        # Compare with expected (if available)
        if expected and "swimlane" in expected:
            if parsed.get("swimlane") == expected.get("swimlane"):
                correct += 1
            total += 1
        
        rewards.append(expected_reward)
        
        if "error" in parsed:
            errors.append({
                "index": i,
                "prompt": prompt[:100],
                "response": response_text[:200],
                "error": parsed["error"]
            })
        
        if (i + 1) % 10 == 0:
            print(f"   Processed {i + 1}/{len(test_data)} examples")
    
    accuracy = correct / total if total > 0 else 0.0
    avg_reward = np.mean(rewards) if rewards else 0.0
    
    return {
        "accuracy": accuracy,
        "avg_reward": avg_reward,
        "total_examples": len(test_data),
        "correct": correct,
        "errors": len(errors),
        "error_examples": errors[:5]  # First 5 errors
    }

def evaluate_prioritizer(model, tokenizer, test_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Evaluate Prioritizer agent"""
    print("\n📊 Evaluating Prioritizer agent...")
    
    correct = 0
    total = 0
    rewards = []
    errors = []
    
    for i, example in enumerate(test_data):
        prompt = example["prompt"]
        expected = example.get("completion", {})
        expected_reward = example.get("reward", 0.0)
        
        # Generate response
        response_text = generate_response(model, tokenizer, prompt, max_new_tokens=256)
        parsed = parse_prioritizer_response(response_text)
        
        # Compare with expected (if available)
        if expected and "recommended_item_id" in expected:
            if parsed.get("recommended_item_id") == expected.get("recommended_item_id"):
                correct += 1
            total += 1
        
        rewards.append(expected_reward)
        
        if "error" in parsed:
            errors.append({
                "index": i,
                "prompt": prompt[:100],
                "response": response_text[:200],
                "error": parsed["error"]
            })
        
        if (i + 1) % 10 == 0:
            print(f"   Processed {i + 1}/{len(test_data)} examples")
    
    accuracy = correct / total if total > 0 else 0.0
    avg_reward = np.mean(rewards) if rewards else 0.0
    
    return {
        "accuracy": accuracy,
        "avg_reward": avg_reward,
        "total_examples": len(test_data),
        "correct": correct,
        "errors": len(errors),
        "error_examples": errors[:5]  # First 5 errors
    }

def main():
    parser = argparse.ArgumentParser(description="Evaluate trained model")
    parser.add_argument("--model", required=True, help="Path to trained model directory")
    parser.add_argument("--test-data", required=True, help="Path to test data JSONL file")
    parser.add_argument("--base-model", help="Base model name (auto-detected if not provided)")
    parser.add_argument("--agent-type", default="FILER", choices=["FILER", "PRIORITIZER", "LIBRARIAN"], help="Agent type")
    parser.add_argument("--output", help="Output file for evaluation results (JSON)")
    parser.add_argument("--no-quantization", action="store_true", help="Disable 4-bit quantization")
    
    args = parser.parse_args()
    
    # Check MPS availability
    if torch.backends.mps.is_available():
        print("✅ MPS (Metal GPU) is available")
    else:
        print("⚠️  MPS not available, using CPU (will be slow)")
    
    # Load test data
    print(f"\n📥 Loading test data...")
    test_data = load_test_data(args.test_data)
    
    if len(test_data) == 0:
        print("❌ No test data found!")
        sys.exit(1)
    
    # Load model
    print(f"\n🤖 Loading model...")
    model, tokenizer = load_model(args.model, args.base_model, use_quantization=not args.no_quantization)
    
    # Evaluate
    if args.agent_type == "FILER":
        results = evaluate_filer(model, tokenizer, test_data)
    elif args.agent_type == "PRIORITIZER":
        results = evaluate_prioritizer(model, tokenizer, test_data)
    else:
        print(f"❌ Evaluation for {args.agent_type} not yet implemented")
        sys.exit(1)
    
    # Print results
    print("\n" + "="*60)
    print("📊 Evaluation Results")
    print("="*60)
    print(f"Agent Type: {args.agent_type}")
    print(f"Total Examples: {results['total_examples']}")
    print(f"Accuracy: {results['accuracy']:.2%}")
    print(f"Average Reward: {results['avg_reward']:.3f}")
    print(f"Correct Predictions: {results['correct']}/{results['total_examples']}")
    print(f"Errors: {results['errors']}")
    
    if results['error_examples']:
        print("\n⚠️  Sample Errors:")
        for err in results['error_examples']:
            print(f"   Example {err['index']}: {err['error']}")
    
    # Save results
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n💾 Results saved to {args.output}")

if __name__ == "__main__":
    main()
