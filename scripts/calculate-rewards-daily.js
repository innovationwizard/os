#!/usr/bin/env node
/**
 * Daily reward calculation script
 * Run this via cron: 0 2 * * * node /path/to/scripts/calculate-rewards-daily.js
 * 
 * Or run directly: node scripts/calculate-rewards-daily.js
 */

require('dotenv').config({ path: '.env' })

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

async function calculateRewards() {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] Starting daily reward calculation...`)

  try {
    // Check API availability
    const healthCheck = await fetch(`${API_URL}/api/training/calculate-pending`)
    if (!healthCheck.ok) {
      throw new Error(`API not available: ${healthCheck.status}`)
    }

    // Get pending count
    const pendingResponse = await healthCheck.json()
    const pendingCount = pendingResponse.pendingRewards || 0

    if (pendingCount === 0) {
      console.log(`[${timestamp}] No pending rewards to calculate`)
      process.exit(0)
    }

    console.log(`[${timestamp}] Found ${pendingCount} pending rewards`)

    // Calculate rewards
    const calculateResponse = await fetch(`${API_URL}/api/training/calculate-pending`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!calculateResponse.ok) {
      const errorText = await calculateResponse.text()
      throw new Error(`Failed to calculate rewards: ${calculateResponse.status} - ${errorText}`)
    }

    const result = await calculateResponse.json()

    if (result.success) {
      console.log(`[${timestamp}] ✅ Successfully processed ${result.processed} rewards (${result.errors} errors)`)
      process.exit(0)
    } else {
      throw new Error(result.message || 'Unknown error')
    }
  } catch (error) {
    console.error(`[${timestamp}] ❌ ERROR: ${error.message}`)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  calculateRewards()
}

module.exports = { calculateRewards }
