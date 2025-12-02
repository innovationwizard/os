#!/bin/bash
# Setup script for RL training environment on M1 Mac

set -e

echo "🚀 Setting up RL training environment for M1 Mac..."

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo "❌ Conda not found. Please install Miniconda or Anaconda first."
    echo "   Download from: https://docs.conda.io/en/latest/miniconda.html"
    exit 1
fi

# Create conda environment
echo "📦 Creating conda environment 'ocd-rl' with Python 3.11..."
conda create -n ocd-rl python=3.11 -y

# Activate environment
echo "🔌 Activating environment..."
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate ocd-rl

# Install PyTorch for M1
echo "🔥 Installing PyTorch for M1 (with MPS support)..."
pip install torch torchvision torchaudio

# Install TRL and dependencies
echo "📚 Installing TRL and dependencies..."
pip install trl transformers peft accelerate bitsandbytes

# Database access
echo "🗄️  Installing database access libraries..."
pip install psycopg2-binary python-dotenv

# Verify MPS availability
echo ""
echo "✅ Verifying MPS availability..."
python -c "import torch; print('MPS available:', torch.backends.mps.is_available())" || {
    echo "⚠️  MPS check failed. PyTorch may not be installed correctly."
}

# Check database connection
echo ""
echo "🔍 Checking database connection..."
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set. Please set it in your .env file."
else
    python -c "
from training.database import get_training_stats
try:
    stats = get_training_stats('FILER')
    print('✅ Database connection OK')
    print(f'   Total decisions: {stats[\"total_decisions\"]}')
except Exception as e:
    print(f'⚠️  Could not connect to database: {e}')
    print('   Check DATABASE_URL in .env file')
" 2>/dev/null || echo "⚠️  Could not verify database connection. Check DATABASE_URL."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Activate environment: conda activate ocd-rl"
echo "2. Set DATABASE_URL in .env file (if not already set)"
echo "3. Export training data: python export_training_data.py --agent-type FILER --output training/data/filer.jsonl"
echo "4. Run training: python train_filer.py"
