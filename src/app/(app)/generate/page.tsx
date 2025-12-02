"use client"

import { useState, useEffect } from "react"
import { Sparkles, FileText, Loader2, CheckCircle2, Edit } from "lucide-react"

interface Opus {
  id: string
  name: string
  opusType: string
}

export default function GeneratePage() {
  const [opuses, setOpuses] = useState<Opus[]>([])
  const [selectedOpuses, setSelectedOpuses] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [requestType, setRequestType] = useState<"GENERATE_DOCUMENT" | "ANSWER_QUESTION" | "FIND_CONTENT">("GENERATE_DOCUMENT")
  const [parameters, setParameters] = useState({
    targetAudience: "",
    context: "",
    format: ""
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    generatedContent: string
    sourceCitations: Array<{ opusId: string; opusName: string; excerpt: string }>
    confidence: number
    reasoning: string
    decisionId: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState("")
  const [feedback, setFeedback] = useState<"CONFIRMED" | "CORRECTED" | null>(null)

  useEffect(() => {
    fetchOpuses()
  }, [])

  const fetchOpuses = async () => {
    try {
      const response = await fetch("/api/opuses")
      if (response.ok) {
        const data = await response.json()
        setOpuses(data)
      }
    } catch (error) {
      console.error("Failed to fetch opuses:", error)
    }
  }

  const handleGenerate = async () => {
    if (!query.trim() || selectedOpuses.length === 0) {
      setError("Please provide a query and select at least one opus")
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setFeedback(null)

    try {
      const response = await fetch("/api/ai/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          parameters,
          relevantOpuses: selectedOpuses.map(id => {
            const opus = opuses.find(o => o.id === id)
            return opus ? {
              id: opus.id,
              name: opus.name
            } : null
          }).filter(Boolean)
        })
      })

      if (!response.ok) {
        throw new Error("Failed to generate document")
      }

      const data = await response.json()
      setResult({
        generatedContent: data.generatedContent,
        sourceCitations: data.sourceCitations,
        confidence: data.confidence,
        reasoning: data.reasoning,
        decisionId: data.decisionId
      })
      setEditedContent(data.generatedContent)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate")
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!result) return

    // Record feedback
    if (result.decisionId) {
      await fetch(`/api/decisions/${result.decisionId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: "CONFIRMED",
          correction: editedContent !== result.generatedContent ? { editedContent } : undefined
        })
      }).catch(console.error)
    }

    setFeedback("CONFIRMED")
  }

  const handleCorrect = async () => {
    if (!result) return

    // Record feedback
    if (result.decisionId) {
      await fetch(`/api/decisions/${result.decisionId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: "CORRECTED",
          correction: { editedContent }
        })
      }).catch(console.error)
    }

    setFeedback("CORRECTED")
  }

  return (
    <div className="px-8 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-blue-600" />
            Generate Document
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Use AI Retriever to generate documents from your Opus Corpus
          </p>
        </header>

        {/* Query Input */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            What would you like to generate?
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., Generate a resume for Company X focusing on AI/ML experience"
            className="w-full h-24 rounded-md border border-slate-300 p-3 text-sm"
          />
        </div>

        {/* Request Type */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Request Type
          </label>
          <select
            value={requestType}
            onChange={(e) => setRequestType(e.target.value as any)}
            className="w-full rounded-md border border-slate-300 p-2 text-sm"
          >
            <option value="GENERATE_DOCUMENT">Generate Document</option>
            <option value="ANSWER_QUESTION">Answer Question</option>
            <option value="FIND_CONTENT">Find Content</option>
          </select>
        </div>

        {/* Opus Selection */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Select Opuses to Use
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {opuses.map(opus => (
              <label key={opus.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded">
                <input
                  type="checkbox"
                  checked={selectedOpuses.includes(opus.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedOpuses([...selectedOpuses, opus.id])
                    } else {
                      setSelectedOpuses(selectedOpuses.filter(id => id !== opus.id))
                    }
                  }}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">{opus.name} ({opus.opusType})</span>
              </label>
            ))}
          </div>
        </div>

        {/* Parameters */}
        {requestType === "GENERATE_DOCUMENT" && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-medium text-slate-900">Parameters</h3>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Target Audience</label>
              <input
                type="text"
                value={parameters.targetAudience}
                onChange={(e) => setParameters({ ...parameters, targetAudience: e.target.value })}
                placeholder="e.g., Hiring manager at tech company"
                className="w-full rounded-md border border-slate-300 p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Context</label>
              <textarea
                value={parameters.context}
                onChange={(e) => setParameters({ ...parameters, context: e.target.value })}
                placeholder="Additional context or requirements"
                className="w-full h-20 rounded-md border border-slate-300 p-2 text-sm"
              />
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !query.trim() || selectedOpuses.length === 0}
          className="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5" />
              Generate
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
            <p className="text-rose-800">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Generated Document
              </h3>
              <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                {Math.round(result.confidence * 100)}% confident
              </span>
            </div>

            {/* Reasoning */}
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-sm text-slate-700">{result.reasoning}</p>
            </div>

            {/* Generated Content Editor */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Content (editable)
              </label>
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-64 rounded-md border border-slate-300 p-3 text-sm font-mono"
              />
            </div>

            {/* Source Citations */}
            {result.sourceCitations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Sources</h4>
                <div className="space-y-2">
                  {result.sourceCitations.map((citation, idx) => (
                    <div key={idx} className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                      <strong>{citation.opusName}</strong>
                      {citation.excerpt && (
                        <p className="mt-1 text-slate-500">{citation.excerpt.substring(0, 150)}...</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {feedback ? (
              <div className="flex items-center justify-center py-2">
                {feedback === "CONFIRMED" ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Feedback recorded!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-blue-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Corrections recorded!</span>
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
                  Accept
                </button>
                <button
                  onClick={handleCorrect}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Edit className="h-4 w-4 inline mr-2" />
                  Mark as Corrected
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
