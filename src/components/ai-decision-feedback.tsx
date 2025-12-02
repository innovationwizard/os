"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, AlertCircle, Brain } from "lucide-react"
import { Feedback } from "@prisma/client"

interface AIDecisionFeedbackProps {
  itemId: string
  statusChangeId: string
  aiReasoning: string | null
  aiConfidence: number | null
  currentSwimlane: string
  currentPriority: string
  currentLabels: string[]
  userFeedback: Feedback | null
  onFeedbackChange: (feedback: Feedback, correction?: {
    swimlane?: string
    priority?: string
    labels?: string[]
  }) => Promise<void>
}

export function AIDecisionFeedback({
  itemId,
  statusChangeId,
  aiReasoning,
  aiConfidence,
  currentSwimlane,
  currentPriority,
  currentLabels,
  userFeedback,
  onFeedbackChange
}: AIDecisionFeedbackProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCorrectionForm, setShowCorrectionForm] = useState(false)
  const [correction, setCorrection] = useState({
    swimlane: currentSwimlane,
    priority: currentPriority,
    labels: currentLabels.join(", ")
  })

  if (!aiReasoning) {
    return null // No AI decision to review
  }

  const confidenceColor = aiConfidence
    ? aiConfidence > 0.8
      ? "text-green-600"
      : aiConfidence > 0.5
        ? "text-amber-600"
        : "text-red-600"
    : "text-slate-600"

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await onFeedbackChange(Feedback.CONFIRMED)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCorrect = async () => {
    if (!showCorrectionForm) {
      setShowCorrectionForm(true)
      return
    }

    setIsSubmitting(true)
    try {
      const labelsArray = correction.labels
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean)

      await onFeedbackChange(Feedback.CORRECTED, {
        swimlane: correction.swimlane !== currentSwimlane ? correction.swimlane : undefined,
        priority: correction.priority !== currentPriority ? correction.priority : undefined,
        labels: labelsArray.length > 0 ? labelsArray : undefined
      })
      setShowCorrectionForm(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleIgnore = async () => {
    setIsSubmitting(true)
    try {
      await onFeedbackChange(Feedback.IGNORED)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-start gap-2 mb-2">
        <Brain className="w-4 h-4 text-purple-600 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-700 mb-1">
            AI Classification
          </div>
          <div className="text-xs text-slate-600 mb-2">
            {aiReasoning}
          </div>
          {aiConfidence !== null && (
            <div className={`text-xs font-medium ${confidenceColor} mb-2`}>
              Confidence: {(aiConfidence * 100).toFixed(0)}%
            </div>
          )}
          <div className="text-xs text-slate-500 space-y-1">
            <div>
              <span className="font-medium">Swimlane:</span> {currentSwimlane}
            </div>
            <div>
              <span className="font-medium">Priority:</span> {currentPriority}
            </div>
            {currentLabels.length > 0 && (
              <div>
                <span className="font-medium">Labels:</span> {currentLabels.join(", ")}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCorrectionForm && (
        <div className="mt-3 p-2 bg-white rounded border border-slate-300 space-y-2">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Swimlane
            </label>
            <select
              value={correction.swimlane}
              onChange={(e) => setCorrection({ ...correction, swimlane: e.target.value })}
              className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
            >
              <option value="EXPEDITE">Expedite</option>
              <option value="PROJECT">Project</option>
              <option value="HABIT">Habit</option>
              <option value="HOME">Home</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Priority
            </label>
            <select
              value={correction.priority}
              onChange={(e) => setCorrection({ ...correction, priority: e.target.value })}
              className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
            >
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Labels (comma-separated)
            </label>
            <input
              type="text"
              value={correction.labels}
              onChange={(e) => setCorrection({ ...correction, labels: e.target.value })}
              className="w-full text-xs px-2 py-1 border border-slate-300 rounded"
              placeholder="Job 1 (Income), Project Name"
            />
          </div>
        </div>
      )}

      {userFeedback ? (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {userFeedback === Feedback.CONFIRMED && (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-green-700 font-medium">Confirmed</span>
            </>
          )}
          {userFeedback === Feedback.CORRECTED && (
            <>
              <XCircle className="w-4 h-4 text-amber-600" />
              <span className="text-amber-700 font-medium">Corrected</span>
            </>
          )}
          {userFeedback === Feedback.IGNORED && (
            <>
              <AlertCircle className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600 font-medium">Ignored</span>
            </>
          )}
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3 h-3" />
            Confirm
          </button>
          <button
            onClick={handleCorrect}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 disabled:opacity-50"
          >
            <XCircle className="w-3 h-3" />
            {showCorrectionForm ? "Submit Correction" : "Correct"}
          </button>
          <button
            onClick={handleIgnore}
            disabled={isSubmitting}
            className="px-2 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 disabled:opacity-50"
          >
            Ignore
          </button>
        </div>
      )}
    </div>
  )
}
