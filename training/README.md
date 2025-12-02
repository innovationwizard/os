# RL Training Setup for M1 Mac

This directory contains the training infrastructure for fine-tuning AI agents using Reinforcement Learning (PPO) on M1 Mac hardware.

## Prerequisites

- M1/M2 Mac (16GB+ RAM recommended)
- Python 3.11+
- Conda (recommended) or venv
- PostgreSQL database access (via DATABASE_URL)

## Setup

### Quick Setup (Recommended)

```bash
# 1. Create conda environment
conda create -n ocd-rl python=3.11
conda activate ocd-rl

# 2. Install PyTorch for M1
pip install torch torchvision torchaudio

# 3. Install TRL
pip install trl transformers peft accelerate bitsandbytes

# 4. Database access
pip install psycopg2-binary python-dotenv
```

### Automated Setup

Use the setup script:

```bash
cd training
bash setup.sh
```

### Verify Setup

```bash
# Check MPS (Metal GPU) support
python -c "import torch; print('MPS available:', torch.backends.mps.is_available())"
# Should print: MPS available: True

# Check database connection
python -c "from training.database import get_training_stats; print(get_training_stats('FILER'))"
```

### Configure Environment

Create a `.env` file in the project root (or copy existing):

```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

See `SETUP.md` for detailed setup instructions and troubleshooting.

## Training

### Export Training Data

Before training, export training data from the database:

```bash
# Export FILER training data
python export_training_data.py \
  --agent-type FILER \
  --output training/data/filer.jsonl \
  --limit 1000 \
  --min-reward -2.0

# Export with user feedback only
python export_training_data.py \
  --agent-type FILER \
  --output training/data/filer-confirmed.jsonl \
  --require-feedback \
  --limit 500
```

Options:
- `--agent-type`: Agent type (FILER, LIBRARIAN, PRIORITIZER, STORER, RETRIEVER)
- `--output`: Output JSONL file path
- `--limit`: Maximum number of examples (default: 1000)
- `--min-reward`: Minimum reward threshold (default: -2.0)
- `--require-feedback`: Only export decisions with user feedback

### Train AI Agents

#### Train AI Filer

**Step 1: Export Training Data**

```bash
# Export from database to JSONL
python export_training_data.py \
  --agent-type FILER \
  --output training/data/filer.jsonl \
  --limit 1000 \
  --min-reward -2.0
```

**Step 2: Train Model**

```bash
python train_filer.py \
  --data training/data/filer.jsonl \
  --output models/ocd-filer-v1 \
  --epochs 3 \
  --batch-size 4
```

Options:
- `--data`: Path to training data JSONL file (required)
- `--output`: Output directory for model (default: `./models/ocd-filer-v1`)
- `--model`: Base model name (default: `meta-llama/Llama-3.1-8B-Instruct`)
- `--epochs`: Number of training epochs (default: 3)
- `--batch-size`: Batch size (default: 4, adjust based on memory)
- `--learning-rate`: Learning rate (default: 1.41e-5)
- `--no-quantization`: Disable 4-bit quantization (not recommended for M1)

#### Train AI Prioritizer

**Step 1: Export Training Data**

```bash
python export_training_data.py \
  --agent-type PRIORITIZER \
  --output training/data/prioritizer.jsonl \
  --limit 1000 \
  --min-reward -2.0
```

**Step 2: Train Model**

```bash
python train_prioritizer.py \
  --data training/data/prioritizer.jsonl \
  --output models/ocd-prioritizer-v1 \
  --epochs 3 \
  --batch-size 4
```

Options are the same as `train_filer.py`, but uses longer context windows (1024 tokens) and longer responses (256 tokens) suitable for prioritization tasks.

### Before Training

1. **Collect Training Data**: The system automatically records decisions when AI agents make choices

2. **Calculate Rewards**: Rewards are calculated daily via cron job, or manually:
   ```bash
   # Via API
   curl -X POST http://localhost:3000/api/training/calculate-pending
   
   # Or via Python script
   python calculate_rewards.py --agent-type FILER
   ```

3. **Export Training Data**: Export decisions to JSONL format:
   ```bash
   python export_training_data.py \
     --agent-type FILER \
     --output training/data/filer.jsonl \
     --limit 1000
   ```

4. **Check Data Availability**:
   ```bash
   python -c "from training.database import get_training_stats; print(get_training_stats('FILER'))"
   ```

## Model Outputs

Trained models are saved to:
- `./models/ocd-filer-v1/` - Final model
- `./models/ocd-filer-v1/checkpoint-epoch-{N}/` - Epoch checkpoints
- `./models/ocd-prioritizer-v1/` - Prioritizer model
- `./models/ocd-prioritizer-v1/checkpoint-epoch-{N}/` - Prioritizer checkpoints

## Evaluation

After training, evaluate your model performance:

```bash
# Evaluate Filer model
python evaluate.py \
  --model models/ocd-filer-v1 \
  --test-data training/data/filer-test.jsonl \
  --agent-type FILER \
  --output evaluation-results.json

# Evaluate Prioritizer model
python evaluate.py \
  --model models/ocd-prioritizer-v1 \
  --test-data training/data/prioritizer-test.jsonl \
  --agent-type PRIORITIZER \
  --output evaluation-results.json
```

Options:
- `--model`: Path to trained model directory (required)
- `--test-data`: Path to test data JSONL file (required)
- `--agent-type`: Agent type (FILER, PRIORITIZER, LIBRARIAN) (default: FILER)
- `--base-model`: Base model name (auto-detected if not provided)
- `--output`: Output file for evaluation results (JSON)
- `--no-quantization`: Disable 4-bit quantization

The evaluation script reports:
- **Accuracy**: Percentage of correct predictions (if ground truth available)
- **Average Reward**: Mean reward across test examples
- **Error Rate**: Number of parsing/format errors
- **Sample Errors**: Examples of failed predictions

## Model Export

Export trained models for deployment:

```bash
# Export merged model (LoRA adapters merged into base model)
python export_model.py \
  --model models/ocd-filer-v1 \
  --output models/ocd-filer-v1-exported \
  --merge

# Export LoRA adapter only (requires base model to load)
python export_model.py \
  --model models/ocd-filer-v1 \
  --output models/ocd-filer-v1-adapter \
  --format lora
```

Options:
- `--model`: Path to trained model directory (required)
- `--output`: Output directory for exported model (required)
- `--base-model`: Base model name (auto-detected if not provided)
- `--merge`: Merge LoRA adapters with base model (default)
- `--format`: Export format (merged, lora, onnx)

**Merged Model**: Full model with adapters merged. Can be loaded directly without base model.
**LoRA Adapter**: Smaller adapter-only export. Requires base model to load.

## Architecture

### Files

**Training Scripts:**
- `train_filer.py` - Main training script for Filer agent
- `train_prioritizer.py` - Training script for Prioritizer agent
- `evaluate.py` - Model evaluation script
- `export_model.py` - Export trained models for deployment

**Utilities:**
- `config.py` - Configuration management
- `database.py` - Database utilities for loading training data
- `prompts.py` - Prompt formatting for each agent
- `reward_calculator.py` - Reward calculation (matches TypeScript implementation)
- `export_training_data.py` - Export training data from database to JSONL
- `calculate_rewards.py` - Calculate rewards for pending decisions

**Setup & Documentation:**
- `requirements.txt` - Python dependencies
- `setup.sh` - Automated setup script for M1 environment
- `README.md` - This file
- `SETUP.md` - Detailed setup instructions
- `QUICKSTART.md` - Quick start guide
- `data/` - Training data directory (JSONL files)

### Training Flow

1. **Load Decisions**: Query `Decision` table for training data
2. **Format Prompts**: Convert state to prompts using agent-specific formatters
3. **Calculate Rewards**: Use stored rewards or calculate from components
4. **PPO Training**: Fine-tune model using Proximal Policy Optimization
5. **Save Model**: Save fine-tuned model and tokenizer

### Reward System

Rewards are calculated using the same logic as `src/lib/reward-calculator.ts`:
- Component-based rewards (immediate, delayed, strategic)
- Weighted sum using hyperparameters
- Normalized to [0, 1] for training

## M1 Mac Considerations

### Memory Management

- **4-bit Quantization**: Models are quantized to fit in memory
- **LoRA**: Only train small adapter layers (~1% of parameters)
- **Small Batches**: Use batch_size=2-4 with gradient accumulation

### Performance

- **MPS Backend**: Uses Metal Performance Shaders (GPU acceleration)
- **Expected Speed**: ~2-5x slower than A100, but viable for development
- **Model Size**: 7B models (Llama 3.1 8B, Mistral 7B) work well

### Troubleshooting

**Out of Memory**:
- Reduce `batch_size` to 2 or 1
- Increase `gradient_accumulation_steps`
- Use smaller model (e.g., Phi-3 instead of Llama 3.1)

**Slow Training**:
- Normal for M1 - expect 10-30 minutes per epoch
- Consider using smaller `max_samples` for faster iteration

**MPS Not Available**:
- Check PyTorch installation: `pip install torch --upgrade`
- Verify macOS version (requires macOS 12.3+)

## Training Workflow

1. **Collect Data**: Use the app - decisions are automatically recorded
2. **Calculate Rewards**: Run daily reward calculation (via cron or API)
3. **Export Data**: Export training data to JSONL format
4. **Train Model**: Run training script with exported data
5. **Evaluate**: Test model performance on held-out data
6. **Export**: Export model for deployment
7. **Deploy**: Update model registry and integrate into Next.js app

## Next Steps

1. **Train Other Agents**: Create `train_librarian.py`, `train_storer.py`, `train_retriever.py`
2. **Hyperparameter Tuning**: Adjust reward weights in `reward_calculator.py`
3. **Evaluation**: Use `evaluate.py` to test model performance on test sets
4. **Deployment**: Export models and integrate fine-tuned models into the Next.js app
5. **A/B Testing**: Use model registry to compare fine-tuned vs. base models

## Integration with Next.js App

After training, you can:

1. **Export Model**: Models are saved in HuggingFace format
2. **Load in TypeScript**: Use `@huggingface/inference` or similar
3. **A/B Testing**: Compare fine-tuned models vs. base models using `modelVersion` field

Example:
```typescript
// In src/lib/ai.ts
const modelVersion = process.env.FILER_MODEL_VERSION || "gpt-4.1-mini-20250101"

if (modelVersion.startsWith("ocd-filer")) {
  // Use fine-tuned model
  const response = await hf.textGeneration({
    model: `./models/${modelVersion}`,
    inputs: prompt
  })
} else {
  // Use OpenAI API
  const response = await openai.chat.completions.create({...})
}
```
