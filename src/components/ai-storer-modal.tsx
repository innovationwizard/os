"use client"

import { useState, useEffect } from "react"
import { X, FileText, CheckCircle2, XCircle, Loader2, Edit } from "lucide-react"
import { GitSyncModal } from "./git-sync-modal"
import { generateCommitMessage } from "@/lib/git-utils"

interface CompletedItem {
  id: string
  title: string
  rawInstructions: string
  routingNotes: string | null
  labels: string[]
  cycleCount: number
  totalTimeInCreate: number | null
  wasBlocked: boolean
}

interface Opus {
  id: string
  name: string
  content: string
  opusType: string
  repositoryPath?: string | null
}

interface StorerModalProps {
  item: CompletedItem
  opus: Opus
  isOpen: boolean
  onClose: () => void
  onIntegrate: () => void
  userId: string
}

export function AIStorerModal({
  item,
  opus,
  isOpen,
  onClose,
  onIntegrate,
  userId
}: StorerModalProps) {
  const [loading, setLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<{
    integrationDecision: "INTEGRATE" | "COLD_STORAGE"
    location: string | null
    method: "APPEND" | "MERGE" | "REPLACE" | "NEW_SECTION"
    newSectionHeading: string | null
    suggestedContent: string | null
    confidence: number
    reasoning: string
    decisionId: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<"CONFIRMED" | "CORRECTED" | null>(null)
  const [editedContent, setEditedContent] = useState("")
  const [showGitSync, setShowGitSync] = useState(false)

  useEffect(() => {
    if (isOpen && !suggestion) {
      getIntegrationSuggestion()
    }
  }, [isOpen])

  const getIntegrationSuggestion = async () => {
    setLoading(true)
    setError(null)
    setSuggestion(null)

    try {
      const input = {
        completedItem: {
          id: item.id,
          title: item.title,
          rawInstructions: item.rawInstructions,
          routingNotes: item.routingNotes,
          labels: item.labels,
          outcomeMetrics: {
            cycleCount: item.cycleCount,
            totalTimeInCreate: item.totalTimeInCreate || 0,
            wasBlocked: item.wasBlocked
          }
        },
        targetOpus: {
          id: opus.id,
          name: opus.name,
          content: opus.content,
          opusType: opus.opusType,
          structure: {
            sections: [] // Would need to parse opus structure
          }
        },
        previousIntegrations: []
      }

      const result = await fetch("/api/ai/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, userId })
      })

      if (!result.ok) {
        throw new Error("Failed to get integration suggestion")
      }

      const data = await result.json()
      setSuggestion({
        integrationDecision: data.integrationDecision,
        location: data.location,
        method: data.method,
        newSectionHeading: data.newSectionHeading,
        suggestedContent: data.suggestedContent,
        confidence: data.confidence,
        reasoning: data.reasoning,
        decisionId: data.decisionId
      })
      setEditedContent(data.suggestedContent || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get suggestion")
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!suggestion) return

    // Record feedback
    if (suggestion.decisionId) {
      await fetch(`/api/decisions/${suggestion.decisionId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: "CONFIRMED",
          correction: editedContent !== suggestion.suggestedContent ? { editedContent } : undefined
        })
      }).catch(console.error)
    }

    // Perform integration
    try {
      const response = await fetch(`/api/opuses/${opus.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: suggestion.method === "APPEND"
            ? `${opus.content}\n\n## ${item.title}\n\n${editedContent}`
            : editedContent // Simplified - would need proper integration logic
        })
      })

      if (response.ok) {
        setFeedback("CONFIRMED")
        
        // Check if opus is CODEBASE type and has repository path
        if (opus.opusType === "CODEBASE" && opus.repositoryPath) {
          setShowGitSync(true)
        } else {
          setTimeout(() => {
            onIntegrate()
            onClose()
            setSuggestion(null)
            setFeedback(null)
          }, 1000)
        }
      }
    } catch (err) {
      console.error("Failed to integrate:", err)
    }
  }

  const handleReject = async () => {
    if (!suggestion) return

    // Record feedback
    if (suggestion.decisionId) {
      await fetch(`/api/decisions/${suggestion.decisionId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: "CORRECTED"
        })
      }).catch(console.error)
    }

    setFeedback("CORRECTED")
    setTimeout(() => {
      onClose()
      setSuggestion(null)
      setFeedback(null)
    }, 500)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-4xl max-h-[90vh] rounded-lg border border-slate-200 bg-white shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-slate-900">Integrate into Opus</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-md transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
              <p className="text-slate-600">Analyzing integration options...</p>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
              <p className="text-rose-800">{error}</p>
            </div>
          )}

          {suggestion && !loading && (
            <>
              {/* Item Info */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-900 mb-2">Completed Item</h3>
                <h4 className="text-lg font-medium text-slate-900">{item.title}</h4>
                {item.rawInstructions && (
                  <p className="text-sm text-slate-700 mt-2">{item.rawInstructions}</p>
                )}
              </div>

              {/* Opus Info */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Target Opus: {opus.name}</h3>
                <p className="text-sm text-blue-800">
                  {opus.content.substring(0, 300)}
                  {opus.content.length > 300 ? "..." : ""}
                </p>
              </div>

              {/* Integration Suggestion */}
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-green-900">Integration Suggestion</h3>
                  <span className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
                    {Math.round(suggestion.confidence * 100)}% confident
                  </span>
                </div>
                <div className="space-y-2 text-sm text-green-800">
                  <p><strong>Decision:</strong> {suggestion.integrationDecision}</p>
                  <p><strong>Method:</strong> {suggestion.method}</p>
                  {suggestion.location && (
                    <p><strong>Location:</strong> {suggestion.location}</p>
                  )}
                  {suggestion.newSectionHeading && (
                    <p><strong>New Section:</strong> {suggestion.newSectionHeading}</p>
                  )}
                </div>
                <div className="mt-3 rounded-md bg-white p-3">
                  <h4 className="font-medium text-green-900 mb-2">Reasoning</h4>
                  <p className="text-sm text-green-800">{suggestion.reasoning}</p>
                </div>
              </div>

              {/* Suggested Content Editor */}
              {suggestion.suggestedContent && (
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      Suggested Content
                    </h3>
                  </div>
                  <textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full h-48 rounded-md border border-slate-300 p-3 text-sm font-mono"
                    placeholder="Edit the suggested integration content..."
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {suggestion && !loading && (
          <div className="border-t border-slate-200 p-6">
            {feedback ? (
              <div className="flex items-center justify-center py-2">
                {feedback === "CONFIRMED" ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Integrated successfully!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-600">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Integration cancelled</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleAccept}
                  className="flex-1 rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4 inline mr-2" />
                  Accept & Integrate
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <XCircle className="h-4 w-4 inline mr-2" />
                  Skip Integration
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Git Sync Modal */}
      {showGitSync && opus.repositoryPath && (
        <GitSyncModal
          opusId={opus.id}
          repositoryPath={opus.repositoryPath}
          itemTitle={item.title}
          defaultCommitMessage={generateCommitMessage({
            title: item.title,
            rawInstructions: item.rawInstructions,
            labels: item.labels,
            cycleCount: item.cycleCount
          })}
          isOpen={showGitSync}
          onClose={() => {
            setShowGitSync(false)
            setTimeout(() => {
              onIntegrate()
              onClose()
              setSuggestion(null)
              setFeedback(null)
            }, 500)
          }}
          onComplete={(committed, pushed) => {
            console.log(`Git sync: committed=${committed}, pushed=${pushed}`)
            setShowGitSync(false)
            setTimeout(() => {
              onIntegrate()
              onClose()
              setSuggestion(null)
              setFeedback(null)
            }, 500)
          }}
        />
      )}
    </div>
  )
}
