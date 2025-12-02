# Background Job Scheduler

This document describes the background job scheduler for automated reward calculation and outcome tracking.

## Overview

The cron scheduler runs two main jobs:
1. **Reward Calculation** - Calculates rewards for decisions with completed outcomes (runs hourly at :00)
2. **Outcome Tracking** - Tracks outcomes for items that reached terminal states (runs hourly at :15)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Internal API key for cron job authentication
INTERNAL_API_KEY=your-secret-api-key-here

# API base URL (defaults to http://localhost:3000)
API_BASE_URL=http://localhost:3000

# Database URL (required)
DATABASE_URL=postgresql://...
```

### 3. Run the Cron Scheduler

**Development:**
```bash
npm run cron
```

**Production:**
```bash
# Run as a background process
npm run cron &

# Or use PM2
pm2 start cron.ts --interpreter tsx --name ocd-cron

# Or use systemd (Linux)
# See systemd example below
```

## Deployment Options

### Option 1: Standalone Process (Recommended for VPS/Dedicated Server)

Run the cron scheduler as a separate Node.js process:

```bash
# Using PM2
pm2 start cron.ts --interpreter tsx --name ocd-cron
pm2 save
pm2 startup
```

### Option 2: Vercel Cron Jobs

For Vercel deployments, use `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/training/calculate-pending",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/training/outcomes",
      "schedule": "15 * * * *"
    }
  ]
}
```

**Note:** Vercel cron jobs require the endpoints to be publicly accessible. You may want to add additional security (e.g., API key check in the endpoint itself).

### Option 3: External Cron Service

Use services like:
- [cron-job.org](https://cron-job.org)
- [EasyCron](https://www.easycron.com)
- [Cronitor](https://cronitor.io)

Configure them to call:
- `POST https://your-domain.com/api/training/calculate-pending` (with `x-internal-api-key` header)
- `POST https://your-domain.com/api/training/outcomes` (with `x-internal-api-key` header)

### Option 4: System Cron (Linux/Mac)

Add to crontab (`crontab -e`):

```bash
# Reward calculation - every hour at :00
0 * * * * cd /path/to/ocd && /usr/bin/tsx cron.ts --job=rewards >> /var/log/ocd-cron.log 2>&1

# Outcome tracking - every hour at :15
15 * * * * cd /path/to/ocd && /usr/bin/tsx cron.ts --job=outcomes >> /var/log/ocd-cron.log 2>&1
```

Or create a systemd service:

```ini
# /etc/systemd/system/ocd-cron.service
[Unit]
Description=OCD Background Job Scheduler
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/ocd
Environment="NODE_ENV=production"
Environment="DATABASE_URL=postgresql://..."
Environment="INTERNAL_API_KEY=your-secret-key"
Environment="API_BASE_URL=http://localhost:3000"
ExecStart=/usr/bin/tsx cron.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable ocd-cron
sudo systemctl start ocd-cron
sudo systemctl status ocd-cron
```

## Manual Execution

You can also trigger jobs manually:

```bash
# Calculate rewards
curl -X POST http://localhost:3000/api/training/calculate-pending \
  -H "x-internal-api-key: your-secret-key"

# Track outcomes
curl -X POST http://localhost:3000/api/training/outcomes \
  -H "x-internal-api-key: your-secret-key"
```

Or via the UI (if authenticated):
- Visit `/api/training/calculate-pending` (POST)
- Visit `/api/training/outcomes` (POST)

## Monitoring

Check logs for job execution:

```bash
# If running as PM2 process
pm2 logs ocd-cron

# If running standalone
# Logs appear in console output
```

## Troubleshooting

### Cron job not running

1. **Check environment variables:**
   ```bash
   echo $DATABASE_URL
   echo $INTERNAL_API_KEY
   ```

2. **Check API connectivity:**
   ```bash
   curl http://localhost:3000/api/training/calculate-pending
   ```

3. **Check logs:**
   - Look for error messages in console/logs
   - Check database connection
   - Verify API endpoints are accessible

### Jobs running but no results

1. **Check if there are pending decisions:**
   ```bash
   curl http://localhost:3000/api/training/calculate-pending
   # Returns count of pending rewards
   ```

2. **Check database:**
   - Verify items are in DONE/COLD_STORAGE status
   - Verify decisions exist with `reward: null`
   - Check for errors in decision processing

### Authentication errors

- Verify `INTERNAL_API_KEY` matches in both `.env` and cron job
- Check that API endpoints accept the `x-internal-api-key` header
- For Vercel, ensure endpoints are publicly accessible or use Vercel Cron

## Schedule Customization

Edit `cron.ts` to change schedules:

```typescript
// Every hour at :00
cron.schedule("0 * * * *", ...)

// Every 30 minutes
cron.schedule("*/30 * * * *", ...)

// Daily at 2 AM
cron.schedule("0 2 * * *", ...)

// Every 6 hours
cron.schedule("0 */6 * * *", ...)
```

See [node-cron documentation](https://github.com/node-cron/node-cron) for schedule syntax.
