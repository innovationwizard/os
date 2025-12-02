#!/usr/bin/env tsx
/**
 * Background Job Scheduler
 * 
 * Runs scheduled tasks for the OCD training system:
 * - Reward calculation (hourly)
 * - Outcome tracking (hourly)
 * 
 * Usage:
 *   npm run cron
 *   # or
 *   tsx cron.ts
 * 
 * For production, consider using:
 * - Vercel Cron Jobs (vercel.json)
 * - External cron service (cron-job.org, EasyCron)
 * - System cron (crontab)
 */

import cron from "node-cron"

// Ensure we're in the right environment
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL not set. Cannot run cron jobs.")
  process.exit(1)
}

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "change-me-in-production"
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000"

/**
 * Call internal API endpoint with authentication
 */
async function callInternalAPI(endpoint: string) {
  try {
    const url = `${API_BASE_URL}${endpoint}`
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": INTERNAL_API_KEY
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(`API call failed: ${error.error || response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error(`Failed to call ${endpoint}:`, error)
    throw error
  }
}

/**
 * Calculate rewards for pending decisions
 * Runs every hour at minute 0
 */
cron.schedule("0 * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running reward calculation...`)
  try {
    const result = await callInternalAPI("/api/training/calculate-pending")
    console.log(`✅ Reward calculation complete:`, result)
  } catch (error) {
    console.error("❌ Reward calculation failed:", error)
  }
})

/**
 * Track outcomes for items that reached terminal states
 * Runs every hour at minute 15
 */
cron.schedule("15 * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running outcome tracking...`)
  try {
    const result = await callInternalAPI("/api/training/outcomes")
    console.log(`✅ Outcome tracking complete:`, result)
  } catch (error) {
    console.error("❌ Outcome tracking failed:", error)
  }
})

console.log("🚀 Background job scheduler started")
console.log("   Reward calculation: Every hour at :00")
console.log("   Outcome tracking: Every hour at :15")
console.log("   Press Ctrl+C to stop")

// Keep process alive
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down cron scheduler...")
  process.exit(0)
})

process.on("SIGTERM", () => {
  console.log("\n👋 Shutting down cron scheduler...")
  process.exit(0)
})
