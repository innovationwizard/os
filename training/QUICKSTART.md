# Quick Start: M1 Training Pipeline

Complete guide to train your first model on M1 Mac.

## Prerequisites

✅ Conda environment set up (`conda activate ocd-rl`)  
✅ Database accessible (`DATABASE_URL` in `.env`)  
✅ At least 100 decisions with rewards calculated

## Step-by-Step

### 1. Calculate Rewards (if needed)

```bash
# Check pending rewards
curl http://localhost:3000/api/training/track-outcomes

# Calculate rewards for completed items
curl -X POST http://localhost:3000/api/training/track-outcomes

# Or via Python
python calculate_rewards.py --agent-type FILER
```

### 2. Export Training Data

```bash
python export_training_data.py \
  --agent-type FILER \
  --output training/data/filer.jsonl \
  --limit 1000
```

This creates `training/data/filer.jsonl` with format:
```json
{
  "prompt": "<|system|>...<|user|>...<|assistant|>",
  "completion": "{\"swimlane\":\"PROJECT\",...}",
  "reward": 1.2,
  "confidence": 0.85,
  "metadata": {...}
}
```

### 3. Train Model

```bash
python train_filer.py \
  --data training/data/filer.jsonl \
  --output models/ocd-filer-v1 \
  --epochs 3 \
  --batch-size 4
```

**Expected output:**
```
✅ MPS (Metal GPU) is available
📥 Loading training data...
✅ Loaded 1000 training examples
🤖 Loading model: meta-llama/Llama-3.1-8B-Instruct
   Using device: mps
   Using 4-bit quantization
   Adding LoRA adapters...
   Trainable parameters: 8,388,608 / 8,000,000,000 (0.10%)

🚀 Starting PPO training...
   Training examples: 1000
   Epochs: 3
   Batch size: 4

📊 Epoch 1/3
   Batch 1: Avg Reward = 0.523
   ...
✅ Epoch 1 complete. Average reward: 0.612
💾 Saved checkpoint to models/ocd-filer-v1/checkpoint-epoch-1

✅ Training complete! Model saved to models/ocd-filer-v1
```

### 4. Verify Model

```bash
# Check model files
ls -lh models/ocd-filer-v1/

# Should see:
# - adapter_config.json
# - adapter_model.bin (or adapter_model.safetensors)
# - tokenizer files
```

## Troubleshooting

### Out of Memory

Reduce batch size:
```bash
python train_filer.py --data training/data/filer.jsonl --batch-size 2
```

Or disable quantization (slower, uses more memory):
```bash
python train_filer.py --data training/data/filer.jsonl --no-quantization
```

### Model Download Fails

Make sure you have HuggingFace access:
```bash
huggingface-cli login
```

### Training Too Slow

- Normal for M1: expect 10-30 minutes per epoch
- Use smaller dataset: `--limit 500` in export
- Reduce epochs: `--epochs 1` for testing

### No Training Data

1. Check decisions exist: `curl http://localhost:3000/api/training/stats`
2. Calculate rewards: `curl -X POST http://localhost:3000/api/training/track-outcomes`
3. Export again: `python export_training_data.py ...`

## Next Steps

After training:

1. **Test Model**: Load and test inference
2. **Evaluate**: Compare against baseline
3. **Deploy**: Integrate into Next.js app
4. **Iterate**: Train with more data, tune hyperparameters

## Full Training Workflow

```bash
# 1. Ensure rewards are calculated
python calculate_rewards.py --agent-type FILER

# 2. Export training data
python export_training_data.py \
  --agent-type FILER \
  --output training/data/filer.jsonl \
  --limit 1000 \
  --min-reward -2.0

# 3. Train model
python train_filer.py \
  --data training/data/filer.jsonl \
  --output models/ocd-filer-v1 \
  --epochs 3 \
  --batch-size 4

# 4. (Optional) Test model
python test_model.py --model models/ocd-filer-v1
```
