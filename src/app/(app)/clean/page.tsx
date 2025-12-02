"use client"

import { useEffect, useMemo, useState } from "react"
import { OpusCrudModal } from "@/components/opus-crud-modal"

interface InboxItem {
  id: string
  title: string
  rawInstructions: string
  capturedBy?: {
    name: string | null
  } | null
  routingNotes?: string | null
}

interface ProjectSummary {
  id: string
  title: string
  status: string
}

export default function CleanPage() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [currentItemId, setCurrentItemId] = useState<string | null>(null)
  const [loadingItems, setLoadingItems] = useState(true)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [showOpusModal, setShowOpusModal] = useState(false)

  useEffect(() => {
    void fetchItems()
    void fetchProjects()
  }, [])

  async function fetchItems() {
    setLoadingItems(true)
    try {
      const response = await fetch("/api/items?status=INBOX", {
        cache: "no-store"
      })
      if (!response.ok) throw new Error("Failed to load inbox")
      const data: InboxItem[] = await response.json()
      setItems(data)
      
      // Set the first item as current if no current item is selected
      setCurrentItemId((prevId) => {
        if (data.length > 0 && !prevId) {
          return data[0].id
        }
        // If current item is no longer in the list, reset to first item
        if (prevId && !data.find(item => item.id === prevId)) {
          return data.length > 0 ? data[0].id : null
        }
        return prevId
      })
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingItems(false)
    }
  }

  async function fetchProjects() {
    setLoadingProjects(true)
    try {
      const response = await fetch("/api/projects", { cache: "no-store" })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("[Clean] Failed to load projects:", response.status, errorData)
        if (response.status === 403) {
          console.error("[Clean] User is not CREATOR or not authorized")
        } else if (response.status === 401) {
          console.error("[Clean] User is not authenticated")
        }
        throw new Error(`Failed to load projects: ${response.status} ${errorData.error || ""}`)
      }
      const data: ProjectSummary[] = await response.json()
      console.log(`[Clean] Loaded ${data.length} projects`)
      setProjects(data)
    } catch (error) {
      console.error("[Clean] Error fetching projects:", error)
    } finally {
      setLoadingProjects(false)
    }
  }

  async function handleOpusSelect(opus: { id: string; name: string; opusType: string }) {
    // If it's a PROJECT type, add it to projects list and assign
    if (opus.opusType === "PROJECT") {
      // Refresh projects list to get latest
      await fetchProjects()
      await handleAssign(opus.id)
    }
    setShowOpusModal(false)
  }

  async function handleOpusModalClose() {
    setShowOpusModal(false)
    // Refresh projects when modal closes in case new PROJECT opuses were created
    await fetchProjects()
  }

  const currentItem = useMemo(() => {
    if (!currentItemId) return items[0] ?? null
    return items.find(item => item.id === currentItemId) ?? items[0] ?? null
  }, [items, currentItemId])

  useEffect(() => {
    setConfirmation(null)
    setInstructions(currentItem?.routingNotes ?? "")
  }, [currentItem?.id, currentItem?.routingNotes])

  function handleSelectItem(itemId: string) {
    setCurrentItemId(itemId)
    setConfirmation(null)
  }

  async function handleAssign(opusId: string, options?: { skipGuard?: boolean }) {
    if (!currentItem || (assigning && !options?.skipGuard)) return

    setAssigning(true)
    setConfirmation(null)

    try {
      const response = await fetch(`/api/items/${currentItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opusId, routingNotes: instructions })
      })

      if (!response.ok) {
        throw new Error("Failed to assign project")
      }

      const projectTitle =
        projects.find((project) => project.id === opusId)?.title ?? "project"

      setConfirmation(`Routed to ${projectTitle}. AI Filer is processing...`)
      setInstructions("")
      
      // Refetch items from server to get the actual current state
      // The item's status may have changed from INBOX to TODO or ON_HOLD
      await fetchItems()
      
      // Move to next item if available
      const remainingItems = items.filter(item => item.id !== currentItem?.id)
      if (remainingItems.length > 0) {
        setCurrentItemId(remainingItems[0].id)
      } else {
        setCurrentItemId(null)
      }
      
      // Clear confirmation after a short delay
      setTimeout(() => {
        setConfirmation(null)
      }, 3000)
    } catch (error) {
      console.error(error)
      setConfirmation(null)
    } finally {
      setAssigning(false)
    }
  }

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newProjectTitle.trim()) return

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newProjectTitle.trim() })
      })

      if (!response.ok) {
        throw new Error("Failed to create project")
      }

      const project: ProjectSummary = await response.json()
      setProjects((prev) => [...prev, project])
      setCreatingProject(false)
      setNewProjectTitle("")
      await handleAssign(project.id, { skipGuard: true })
    } catch (error) {
      console.error(error)
    }
  }

  if (loadingItems) {
    return (
      <div className="px-6 py-10">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading inbox…
        </div>
      </div>
    )
  }

  if (!currentItem) {
    return (
      <div className="px-6 py-10">
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Inbox clear</h2>
          <p className="mt-2 text-sm text-slate-500">
            Everything captured has been routed. Proceed to the next step when ready.
          </p>
        </div>
      </div>
    )
  }

  const capturedByLabel = currentItem.capturedBy?.name ?? "Creator"

  return (
    <div className="px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Step 3 · Route
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Decide where this belongs
          </h1>
          <p className="text-sm text-slate-500">
            Items flagged as actionable move here next. Assign each one to the right project before evaluating urgency.
          </p>
        </header>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Captured by {capturedByLabel}
            </span>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              {currentItem.title}
            </h2>
            <p className="min-h-[120px] whitespace-pre-wrap text-sm text-slate-700">
              {currentItem.rawInstructions}
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Route: Which project owns this?
            </p>

            {loadingProjects ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Loading projects…
              </div>
            ) : projects.length > 0 ? (
              <ul className="space-y-2">
                {projects.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => handleAssign(project.id)}
                      disabled={assigning}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
                    >
                      <span className="font-medium text-slate-900">{project.title}</span>
                      <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">
                        {project.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                No projects found yet. Create one below to route this item.
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowOpusModal(true)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
              >
                Manage all opuses
              </button>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Optional instructions
                </label>
                <textarea
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  placeholder="Add context, clarifications, or instructions for next steps"
                  rows={4}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white/60 p-4">
                {creatingProject ? (
                  <form onSubmit={handleCreateProject} className="space-y-3">
                    <input
                      type="text"
                      value={newProjectTitle}
                      onChange={(event) => setNewProjectTitle(event.target.value)}
                      placeholder="Project name"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={assigning}
                        className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        Create & assign
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingProject(false)
                          setNewProjectTitle("")
                        }}
                        className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:border-slate-400 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreatingProject(true)}
                    className="inline-flex items-center text-sm font-medium text-slate-700 hover:text-slate-900"
                  >
                    + Create new project
                  </button>
                )}
              </div>
            </div>
          </div>

          {confirmation && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {confirmation}
            </div>
          )}
        </section>

        {/* Backlog of all items */}
        {items.length > 0 && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">
              Backlog ({items.length} item{items.length === 1 ? "" : "s"} waiting to route):
            </p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {items.map((item, index) => {
                const isCurrent = item.id === currentItemId
                const capturedByLabel = item.capturedBy?.name ?? "Creator"
                
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectItem(item.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isCurrent
                        ? "border-slate-400 bg-white shadow-sm ring-2 ring-slate-300"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400">
                            #{index + 1}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                              Current
                            </span>
                          )}
                        </div>
                        <h3 className={`mt-1 text-sm font-medium ${
                          isCurrent ? "text-slate-900" : "text-slate-700"
                        }`}>
                          {item.title}
                        </h3>
                        <div className="mt-1 text-xs text-slate-500">
                          by {capturedByLabel}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <OpusCrudModal
        isOpen={showOpusModal}
        onClose={handleOpusModalClose}
        onSelect={handleOpusSelect}
        filterType="PROJECT"
      />
    </div>
  )
}

