"use client"

import { useEffect, useState } from "react"
import { RefreshCw, TrendingUp, CheckCircle2, AlertCircle } from "lucide-react"

interface TrainingStats {
  totalDecisions: number
  decisionsWithReward: number
  decisionsWithFeedback: number
  avgReward: number
  progressBlocks: number
  progressInCurrentBlock: number
  progressPercentage: number
  byAgentType: Record<string, number>
  readyForTraining: boolean
}

export function DecisionsCounter({ agentType }: { agentType?: string }) {
  const [stats, setStats] = useState<TrainingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)
      const url = agentType
        ? `/api/training/stats?agentType=${agentType}`
        : "/api/training/stats"
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch stats")
      }
      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [agentType])

  if (loading && !stats) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading Training Stats...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 text-rose-600">
          <AlertCircle className="h-4 w-4" />
          Error Loading Stats
        </div>
        <p className="mt-1 text-sm text-rose-500">{error}</p>
      </div>
    )
  }

  if (!stats) return null

  const { totalDecisions, progressInCurrentBlock, progressPercentage, readyForTraining, decisionsWithReward, avgReward, byAgentType } = stats

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              Training Data Collection
              {readyForTraining && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3 w-3" />
                  Ready
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {agentType ? `${agentType} decisions` : "All agent decisions"}
            </p>
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-2 hover:bg-slate-100 rounded-md transition-colors"
            title="Refresh stats"
          >
            <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Main Counter */}
        <div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold text-slate-900">{totalDecisions}</span>
            <span className="text-slate-500 text-sm">decisions</span>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Block {stats.progressBlocks + 1} of 100</span>
              <span>{progressInCurrentBlock}/100</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  readyForTraining ? "bg-green-500" : "bg-blue-500"
                }`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{stats.progressBlocks} complete blocks</span>
              <span className={readyForTraining ? "text-green-600 font-medium" : "text-slate-600"}>
                {readyForTraining ? "Ready for training" : `${100 - progressInCurrentBlock} more needed`}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200">
          <div>
            <div className="text-sm text-slate-500">With Rewards</div>
            <div className="text-xl font-semibold text-slate-900">{decisionsWithReward}</div>
            <div className="text-xs text-slate-400">
              {totalDecisions > 0 ? `${Math.round((decisionsWithReward / totalDecisions) * 100)}%` : "0%"}
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Avg Reward</div>
            <div className="text-xl font-semibold flex items-center gap-1 text-slate-900">
              <TrendingUp className="h-4 w-4" />
              {avgReward.toFixed(2)}
            </div>
            <div className="text-xs text-slate-400">
              {decisionsWithReward > 0 ? "Calculated" : "Pending"}
            </div>
          </div>
        </div>

        {/* Agent Type Breakdown */}
        {Object.keys(byAgentType).length > 0 && (
          <div className="pt-3 border-t border-slate-200">
            <div className="text-sm text-slate-500 mb-2">By Agent Type</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(byAgentType).map(([type, count]) => (
                <span
                  key={type}
                  className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                >
                  {type}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Training Readiness Indicator */}
        {readyForTraining && (
          <div className="pt-3 border-t border-slate-200 bg-green-50 p-3 rounded-md">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-green-900">
                  Ready for Training
                </div>
                <div className="text-sm text-green-700 mt-1">
                  You have {totalDecisions} decisions with {decisionsWithReward} rewards calculated.
                  Export training data and start training!
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
