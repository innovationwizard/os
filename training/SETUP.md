# Training Environment Setup for M1 Mac

## Quick Setup

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

## Automated Setup

Use the setup script:

```bash
cd training
bash setup.sh
```

## Verify Installation

### Check MPS (Metal GPU) Support

```bash
python -c "import torch; print('MPS available:', torch.backends.mps.is_available())"
```

Should output: `MPS available: True`

### Check Database Connection

```bash
python -c "from training.database import get_training_stats; print(get_training_stats('FILER'))"
```

### Check All Packages

```bash
python -c "
import torch
import transformers
import trl
import peft
import accelerate
import bitsandbytes
import psycopg2
import dotenv
print('✅ All packages installed successfully')
"
```

## Environment Variables

Create a `.env` file in the project root:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

Or copy from existing `.env`:

```bash
cp ../.env .env
```

## Troubleshooting

### Conda Not Found

Install Miniconda:
```bash
# macOS
brew install miniconda

# Or download from: https://docs.conda.io/en/latest/miniconda.html
```

### MPS Not Available

- Check macOS version (requires macOS 12.3+)
- Update PyTorch: `pip install --upgrade torch torchvision torchaudio`
- Verify Metal support: `system_profiler SPDisplaysDataType | grep Metal`

### Database Connection Issues

- Verify `DATABASE_URL` is set correctly
- Test connection: `psql $DATABASE_URL`
- Check if database is accessible from your network

### Import Errors

If you get import errors, make sure you're in the conda environment:

```bash
conda activate ocd-rl
which python  # Should show conda environment path
```

## Next Steps

After setup:

1. **Calculate Rewards**: Ensure rewards are calculated for decisions
   ```bash
   python calculate_rewards.py --agent-type FILER
   ```

2. **Export Training Data**: Export decisions to JSONL
   ```bash
   python export_training_data.py --agent-type FILER --output training/data/filer.jsonl
   ```

3. **Train Model**: Start training
   ```bash
   python train_filer.py --epochs 3 --batch-size 4
   ```
