# Scripts

Utility scripts for the OCD system.

## Daily Reward Calculation

Calculate rewards for all pending decisions every 24 hours.

### Shell Script

**File**: `calculate-rewards-daily.sh`

```bash
# Run manually
bash scripts/calculate-rewards-daily.sh

# Or make executable and run
chmod +x scripts/calculate-rewards-daily.sh
./scripts/calculate-rewards-daily.sh
```

### Node.js Script

**File**: `calculate-rewards-daily.js`

```bash
# Run manually
node scripts/calculate-rewards-daily.js

# Or make executable and run
chmod +x scripts/calculate-rewards-daily.js
./scripts/calculate-rewards-daily.js
```

### Setup Cron Job

1. **Choose your script** (shell or Node.js)

2. **Edit crontab**:
   ```bash
   crontab -e
   ```

3. **Add daily job** (runs at 2 AM):
   ```bash
   # Shell script
   0 2 * * * cd /path/to/ocd && /bin/bash scripts/calculate-rewards-daily.sh >> logs/reward-calculation.log 2>&1
   
   # Or Node.js script
   0 2 * * * cd /path/to/ocd && node scripts/calculate-rewards-daily.js >> logs/reward-calculation.log 2>&1
   ```

4. **Replace `/path/to/ocd`** with your actual project path

5. **Verify**:
   ```bash
   crontab -l
   ```

### Environment Variables

Both scripts use environment variables:

- `API_URL`: API endpoint (defaults to `http://localhost:3000`)
- `LOG_FILE`: Log file path (shell script only, defaults to `./logs/reward-calculation.log`)

Set in `.env` file or export before running:

```bash
export API_URL=http://localhost:3000
node scripts/calculate-rewards-daily.js
```

### Logs

Logs are written to:
- Shell script: `./logs/reward-calculation.log` (or `$LOG_FILE`)
- Node.js script: stdout/stderr (redirect in cron)

### Testing

Test the scripts before setting up cron:

```bash
# Test shell script
bash scripts/calculate-rewards-daily.sh

# Test Node.js script
node scripts/calculate-rewards-daily.js

# Check API endpoint directly
curl http://localhost:3000/api/training/calculate-pending
curl -X POST http://localhost:3000/api/training/calculate-pending
```

### Troubleshooting

**Script fails with "API not available"**:
- Make sure your Next.js app is running
- Check `API_URL` environment variable
- Verify the API endpoint is accessible

**No pending rewards**:
- This is normal if all rewards are already calculated
- Check: `curl http://localhost:3000/api/training/calculate-pending`

**Permission denied**:
- Make scripts executable: `chmod +x scripts/*.sh scripts/*.js`
- Check cron user has access to project directory

**Cron not running**:
- Check cron service is running: `sudo service cron status`
- Check cron logs: `grep CRON /var/log/syslog` (Linux) or `grep cron /var/log/system.log` (macOS)
- Verify crontab is installed: `crontab -l`
