#!/usr/bin/env python3
"""
Export trained model for deployment

This script exports a trained LoRA model by merging adapters with the base model,
or exports the model in a format suitable for deployment.

Usage:
    python export_model.py --model models/ocd-filer-v1 --output models/ocd-filer-v1-exported
    python export_model.py --model models/ocd-filer-v1 --output models/ocd-filer-v1-exported --merge
"""
import os
import sys
import argparse
import json
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel, PeftConfig
from dotenv import load_dotenv

load_dotenv()

def load_model_and_tokenizer(model_path: str, base_model: str = None, use_quantization: bool = False):
    """Load model and tokenizer"""
    print(f"🤖 Loading model from: {model_path}")
    
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
    
    # Quantization config (only if needed for export)
    quantization_config = None
    if use_quantization:
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4"
        )
    
    # Load base model
    base_model_obj = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=quantization_config,
        torch_dtype=torch.float16 if not use_quantization else None,
        trust_remote_code=True
    )
    
    # Check if LoRA adapters exist
    adapter_path = os.path.join(model_path, "adapter_model.bin")
    adapter_safetensors = os.path.join(model_path, "adapter_model.safetensors")
    
    if os.path.exists(adapter_path) or os.path.exists(adapter_safetensors):
        print("   LoRA adapters detected")
        model = PeftModel.from_pretrained(base_model_obj, model_path)
        return model, tokenizer, True
    else:
        print("   No LoRA adapters found, using base model")
        return base_model_obj, tokenizer, False

def export_merged_model(model_path: str, output_path: str, base_model: str = None):
    """Export model with merged LoRA adapters"""
    print(f"\n📦 Exporting merged model...")
    
    # Load model
    model, tokenizer, has_lora = load_model_and_tokenizer(model_path, base_model, use_quantization=False)
    
    if has_lora:
        print("   Merging LoRA adapters with base model...")
        # Merge adapters
        merged_model = model.merge_and_unload()
    else:
        print("   No adapters to merge, using base model")
        merged_model = model
    
    # Save merged model
    print(f"   Saving to {output_path}...")
    os.makedirs(output_path, exist_ok=True)
    
    merged_model.save_pretrained(output_path)
    tokenizer.save_pretrained(output_path)
    
    # Save metadata
    metadata = {
        "base_model": base_model or "auto-detected",
        "source_model": model_path,
        "export_type": "merged",
        "has_lora": has_lora
    }
    
    with open(os.path.join(output_path, "export_metadata.json"), 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"✅ Merged model exported to {output_path}")

def export_lora_model(model_path: str, output_path: str, base_model: str = None):
    """Export LoRA model (adapter-only)"""
    print(f"\n📦 Exporting LoRA adapter model...")
    
    # Load model
    model, tokenizer, has_lora = load_model_and_tokenizer(model_path, base_model, use_quantization=False)
    
    if not has_lora:
        print("⚠️  No LoRA adapters found. Cannot export adapter-only model.")
        return
    
    # Save adapter and config
    print(f"   Saving adapter to {output_path}...")
    os.makedirs(output_path, exist_ok=True)
    
    model.save_pretrained(output_path)
    tokenizer.save_pretrained(output_path)
    
    # Save metadata
    metadata = {
        "base_model": base_model or "auto-detected",
        "source_model": model_path,
        "export_type": "lora_adapter",
        "has_lora": True
    }
    
    with open(os.path.join(output_path, "export_metadata.json"), 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"✅ LoRA adapter exported to {output_path}")
    print(f"   Note: This requires the base model ({base_model or 'auto-detected'}) to load")

def export_onnx(model_path: str, output_path: str, base_model: str = None):
    """Export model to ONNX format (for inference optimization)"""
    print(f"\n📦 Exporting to ONNX format...")
    print("⚠️  ONNX export is experimental and may not work for all models")
    
    try:
        from transformers import convert_graph_to_onnx
        import onnxruntime
        
        # Load model
        model, tokenizer, _ = load_model_and_tokenizer(model_path, base_model, use_quantization=False)
        
        # Export to ONNX
        os.makedirs(output_path, exist_ok=True)
        
        # This is a simplified example - actual ONNX export may require more configuration
        print("   ONNX export requires additional setup. See transformers documentation.")
        print("   For now, use the merged model export instead.")
        
    except ImportError:
        print("❌ ONNX export requires: pip install onnx onnxruntime")
        print("   Skipping ONNX export")

def main():
    parser = argparse.ArgumentParser(description="Export trained model for deployment")
    parser.add_argument("--model", required=True, help="Path to trained model directory")
    parser.add_argument("--output", required=True, help="Output directory for exported model")
    parser.add_argument("--base-model", help="Base model name (auto-detected if not provided)")
    parser.add_argument("--merge", action="store_true", help="Merge LoRA adapters with base model")
    parser.add_argument("--format", choices=["merged", "lora", "onnx"], default="merged", help="Export format")
    
    args = parser.parse_args()
    
    # Check if model exists
    if not os.path.exists(args.model):
        print(f"❌ Model directory not found: {args.model}")
        sys.exit(1)
    
    # Export based on format
    if args.merge or args.format == "merged":
        export_merged_model(args.model, args.output, args.base_model)
    elif args.format == "lora":
        export_lora_model(args.model, args.output, args.base_model)
    elif args.format == "onnx":
        export_onnx(args.model, args.output, args.base_model)
    
    print("\n✅ Export complete!")
    print(f"\nNext steps:")
    print(f"1. Test the exported model:")
    print(f"   python evaluate.py --model {args.output} --test-data training/data/test.jsonl")
    print(f"2. Deploy to your inference server")
    print(f"3. Update model-registry.ts with the new model version")

if __name__ == "__main__":
    main()
