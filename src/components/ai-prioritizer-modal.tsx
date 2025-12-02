"use client"

import { useState, useEffect } from "react"
import { X, Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { Feedback } from "@prisma/client"

interface TodoItem {
  id: string
  title: string
  rawInstructions: string
  swimlane: string
  priority: string
  labels: string[]
  opusId: string | null
  statusChangedAt: string
  lastProgressAt: string | null
}

interface PrioritizerModalProps {
  todoItems: TodoItem[]
  isOpen: boolean
  onClose: () => void
  onAccept: (itemId: string) => void
  userId: string
}

export function AIPrioritizerModal({
  todoItems,
  isOpen,
  onClose,
  onAccept,
  userId
}: PrioritizerModalProps) {
  const [loading, setLoading] = useState(false)
  const [recommendation, setRecommendation] = useState<{
    itemId: string
    confidence: number
    reasoning: string
    decisionId: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<"CONFIRMED" | "CORRECTED" | null>(null)

  useEffect(() => {
    if (isOpen && todoItems.length > 0 && !recommendation) {
      getRecommendation()
    }
  }, [isOpen, todoItems])

  const getRecommendation = async () => {
    if (todoItems.length === 0) {
      setError("No TODO items available")
      return
    }

    setLoading(true)
    setError(null)
    setRecommendation(null)
    setFeedback(null)

    try {
      // Prepare input for Prioritizer
      const input = {
        todoItems: todoItems.map(item => ({
          id: item.id,
          title: item.title,
          swimlane: item.swimlane,
          priority: item.priority,
          labels: item.labels,
          age: Math.floor(
            (Date.now() - new Date(item.statusChangedAt).getTime()) / (1000 * 60 * 60 * 24)
          ),
          opusName: null // Would need to fetch opus name
        })),
        currentContext: {
          timeOfDay: new Date().toLocaleTimeString(),
          recentWork: [],
          energyLevel: "medium" as const
        },
        strategicGoals: {
          monetization: [],
          portfolio: [],
          authority: []
        },
        constraints: {
          deadlines: [],
          stakeholderRequests: []
        }
      }

      const result = await fetch("/api/ai/prioritize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, userId })
      })

      if (!result.ok) {
        throw new Error("Failed to get recommendation")
      }

      const data = await result.json()
      setRecommendation({
        itemId: data.recommended_item_id,
        confidence: data.confidence,
        reasoning: data.reasoning,
        decisionId: data.decisionId
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get recommendation")
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!recommendation) return

    // Record feedback
    if (recommendation.decisionId) {
      await fetch(`/api/decisions/${recommendation.decisionId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: "CONFIRMED"
        })
      }).catch(console.error)
    }

    setFeedback("CONFIRMED")
    onAccept(recommendation.itemId)
    
    // Close after a short delay
    setTimeout(() => {
      onClose()
      setRecommendation(null)
      setFeedback(null)
    }, 1000)
  }

  const handleReject = async () => {
    if (!recommendation) return

    // Record feedback
    if (recommendation.decisionId) {
      await fetch(`/api/decisions/${recommendation.decisionId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: "CORRECTED"
        })
      }).catch(console.error)
    }

    setFeedback("CORRECTED")
    
    // Get new recommendation
    setTimeout(() => {
      setRecommendation(null)
      setFeedback(null)
      getRecommendation()
    }, 500)
  }

  if (!isOpen) return null

  const recommendedItem = recommendation
    ? todoItems.find(item => item.id === recommendation.itemId)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-900">AI: Suggest Next Task</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <p className="text-slate-600">Analyzing {todoItems.length} TODO items...</p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
            <p className="text-rose-800">{error}</p>
            <button
              onClick={getRecommendation}
              className="mt-2 text-sm text-rose-600 hover:text-rose-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {recommendation && recommendedItem && !loading && (
          <div className="space-y-4">
            {/* Recommendation */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-blue-900">Recommended Task</h3>
                <span className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                  {Math.round(recommendation.confidence * 100)}% confident
                </span>
              </div>
              <h4 className="text-lg font-medium text-blue-900 mb-2">
                {recommendedItem.title}
              </h4>
              {recommendedItem.rawInstructions && (
                <p className="text-sm text-blue-800 mb-3">
                  {recommendedItem.rawInstructions.substring(0, 200)}
                  {recommendedItem.rawInstructions.length > 200 ? "..." : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {recommendedItem.swimlane}
                </span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {recommendedItem.priority}
                </span>
                {recommendedItem.labels.map(label => (
                  <span
                    key={label}
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Reasoning */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h4 className="font-medium text-slate-900 mb-2">Why this task?</h4>
              <p className="text-sm text-slate-700">{recommendation.reasoning}</p>
            </div>

            {/* Actions */}
            {feedback ? (
              <div className="flex items-center justify-center py-4">
                {feedback === "CONFIRMED" ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Accepted! Moving task to CREATING...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="font-medium">Getting new recommendation...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleAccept}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4 inline mr-2" />
                  Accept & Start
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <XCircle className="h-4 w-4 inline mr-2" />
                  Suggest Different
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && !error && !recommendation && (
          <div className="text-center py-8 text-slate-500">
            <p>No recommendation available</p>
            <button
              onClick={getRecommendation}
              className="mt-4 text-blue-600 hover:text-blue-800 underline"
            >
              Get recommendation
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
