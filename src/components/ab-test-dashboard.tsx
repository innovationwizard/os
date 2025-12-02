"use client"

import { useState, useEffect } from "react"
import { BarChart3, TrendingUp, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react"
import { AgentType } from "@prisma/client"

interface VersionStats {
  version: string
  description?: string
  weight: number
  stats: {
    totalDecisions: number
    decisionsWithReward: number
    decisionsWithFeedback: number
    avgReward: number | null
    avgConfidence: number | null
    acceptanceRate: number | null
    feedbackBreakdown: {
      confirmed: number
      corrected: number
      ignored: number
    }
  }
}

interface ABTestData {
  agentType: string
  abTestingEnabled: boolean
  totalDecisions: number
  overallAvgReward: number | null
  versions: VersionStats[]
  comparison?: {
    bestReward: VersionStats
    bestAcceptanceRate: VersionStats
    mostDecisions: VersionStats
  }
}

export function ABTestDashboard() {
  const [selectedAgentType, setSelectedAgentType] = useState<AgentType>(AgentType.FILER)
  const [data, setData] = useState<ABTestData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchABTestData()
  }, [selectedAgentType])

  const fetchABTestData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/training/ab-test?agentType=${selectedAgentType}`)
      if (!response.ok) {
        throw new Error("Failed to fetch A/B test data")
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load A/B test data")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
        <p className="text-rose-800">{error}</p>
      </div>
    )
  }

  if (!data) {
    return null
  }

  if (!data.abTestingEnabled) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">A/B Testing</h2>
        </div>
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <p className="text-blue-800">
            A/B testing is not enabled for {data.agentType}. Only one version is configured.
          </p>
          <div className="mt-3 space-y-1">
            {data.versions.map((v, idx) => (
              <p key={idx} className="text-sm text-blue-700">
                • {v.version} {v.description && `(${v.description})`}
              </p>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const bestReward = data.comparison?.bestReward
  const bestAcceptance = data.comparison?.bestAcceptanceRate

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">A/B Test Dashboard</h2>
        </div>
        <select
          value={selectedAgentType}
          onChange={(e) => setSelectedAgentType(e.target.value as AgentType)}
          className="rounded-md border border-slate-300 px-3 py-1 text-sm"
        >
          {Object.values(AgentType).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600 mb-1">Total Decisions</p>
          <p className="text-2xl font-semibold text-slate-900">{data.totalDecisions}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600 mb-1">Overall Avg Reward</p>
          <p className="text-2xl font-semibold text-slate-900">
            {data.overallAvgReward !== null ? data.overallAvgReward.toFixed(3) : "N/A"}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600 mb-1">Versions Testing</p>
          <p className="text-2xl font-semibold text-slate-900">{data.versions.length}</p>
        </div>
      </div>

      {/* Version Comparison */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900">Version Performance</h3>
        {data.versions.map((version, idx) => {
          const isBestReward = bestReward?.version === version.version
          const isBestAcceptance = bestAcceptance?.version === version.version

          return (
            <div
              key={idx}
              className={`rounded-lg border p-4 ${
                isBestReward || isBestAcceptance
                  ? "border-green-300 bg-green-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-900">{version.version}</h4>
                    {isBestReward && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Best Reward
                      </span>
                    )}
                    {isBestAcceptance && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Best Acceptance
                      </span>
                    )}
                  </div>
                  {version.description && (
                    <p className="text-sm text-slate-600 mt-1">{version.description}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">Weight: {(version.weight * 100).toFixed(0)}%</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Decisions</p>
                  <p className="text-lg font-semibold text-slate-900">{version.stats.totalDecisions}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-1">Avg Reward</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {version.stats.avgReward !== null ? version.stats.avgReward.toFixed(3) : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-1">Acceptance Rate</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {version.stats.acceptanceRate !== null
                      ? `${(version.stats.acceptanceRate * 100).toFixed(1)}%`
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-1">Avg Confidence</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {version.stats.avgConfidence !== null
                      ? version.stats.avgConfidence.toFixed(2)
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Feedback Breakdown */}
              {version.stats.feedbackBreakdown.confirmed +
                version.stats.feedbackBreakdown.corrected +
                version.stats.feedbackBreakdown.ignored >
                0 && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-xs text-slate-600 mb-2">Feedback Breakdown</p>
                  <div className="flex gap-2">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      ✓ {version.stats.feedbackBreakdown.confirmed} Confirmed
                    </span>
                    <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded">
                      ✗ {version.stats.feedbackBreakdown.corrected} Corrected
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                      ⊘ {version.stats.feedbackBreakdown.ignored} Ignored
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Refresh Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={fetchABTestData}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>
    </div>
  )
}
