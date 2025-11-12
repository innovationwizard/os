"use client"

import { useEffect, useState } from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult
} from "@hello-pangea/dnd"
import { AlertTriangle, Clock } from "lucide-react"

interface Item {
  id: string
  humanId: string
  title: string
  rawInstructions: string
  status: string
  priority: "HIGH" | "MEDIUM" | "LOW"
  swimlane: string
  labels: string[]
  createdAt: string
  statusChangedAt: string
}

interface ColumnConfig {
  title: string
  color: string
  wipLimit?: number
}

const COLUMNS: Record<string, ColumnConfig> = {
  ON_HOLD: { title: "On Hold", color: "bg-slate-200" },
  BLOCKED: { title: "Blocked", color: "bg-rose-100" },
  TODO: { title: "To Do", color: "bg-slate-100" },
  CREATE: { title: "Doing", color: "bg-blue-100", wipLimit: 1 },
  IN_REVIEW: { title: "Testing", color: "bg-amber-100" },
  DONE: { title: "Done", color: "bg-emerald-100" }
}

// Column order from left to right
const COLUMN_ORDER = ["ON_HOLD", "BLOCKED", "TODO", "CREATE", "IN_REVIEW", "DONE"]

const SWIMLANES = ["EXPEDITE", "PROJECT", "HABIT", "HOME"]

const PRIORITY_BORDERS = {
  HIGH: "border-rose-500",
  MEDIUM: "border-amber-500",
  LOW: "border-slate-300"
}

export default function WorkflowPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [dragError, setDragError] = useState("")

  useEffect(() => {
    refreshItems()
  }, [])

  async function refreshItems() {
    setLoading(true)
    try {
      const response = await fetch("/api/workflow/items")
      const data: Item[] = await response.json()
      setItems(data)
    } catch (error) {
      console.error("Failed to fetch workflow items", error)
    } finally {
      setLoading(false)
    }
  }

  function daysSince(date: string) {
    const delta = Date.now() - new Date(date).getTime()
    return Math.floor(delta / (1000 * 60 * 60 * 24))
  }

  function itemsBy(status: string, swimlane: string) {
    return items
      .filter((item) => item.status === status && item.swimlane === swimlane)
      .sort((a, b) => {
        const priorityOrder: Record<Item["priority"], number> = {
          HIGH: 0,
          MEDIUM: 1,
          LOW: 2
        }
        const priorityDiff =
          priorityOrder[a.priority] - priorityOrder[b.priority]
        if (priorityDiff !== 0) return priorityDiff
        return (
          new Date(a.statusChangedAt).getTime() -
          new Date(b.statusChangedAt).getTime()
        )
      })
  }

  async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result

    setDragError("")

    if (!destination) return
    if (destination.droppableId === source.droppableId) return

    const item = items.find((entry) => entry.id === draggableId)
    if (!item) return

    const [nextStatus] = destination.droppableId.split("-")

    if (nextStatus === "CREATE") {
      const inCreate = items.filter((entry) => entry.status === "CREATE")
      if (inCreate.length >= 1) {
        setDragError("Only one item can be in Create at a time.")
        setTimeout(() => setDragError(""), 3000)
        return
      }
    }

    setItems((prev) =>
      prev.map((entry) =>
        entry.id === draggableId
          ? {
              ...entry,
              status: nextStatus,
              statusChangedAt: new Date().toISOString()
            }
          : entry
      )
    )

    try {
      const response = await fetch(`/api/items/${draggableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      })

      if (!response.ok) {
        await refreshItems()
      }
    } catch (error) {
      console.error("Failed to update item", error)
      await refreshItems()
    }
  }

  if (loading) {
    return (
      <div className="px-8 py-10">
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading workflow…
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-8 py-5">
        <h1 className="text-2xl font-semibold text-slate-900">Workflow</h1>
        {dragError && (
          <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {dragError}
          </p>
        )}
      </header>

      <div className="flex-1 overflow-auto px-6 py-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid min-w-[1320px] grid-cols-6 gap-4">
            {COLUMN_ORDER.map((status) => {
              const config = COLUMNS[status]
              if (!config) return null
              return (
                <section key={status} className="flex flex-col">
                <div
                  className={`rounded-t-md px-3 py-2 text-sm font-medium text-slate-700 ${config.color}`}
                >
                  {config.title}
                  {config.wipLimit && (
                    <span className="ml-2 text-xs text-slate-500">
                      ({items.filter((item) => item.status === status).length}/
                      {config.wipLimit})
                    </span>
                  )}
                </div>
                <div className="flex-1 rounded-b-md border border-t-0 border-slate-200 bg-slate-50">
                  {SWIMLANES.map((swimlane) => (
                    <Droppable
                      key={`${status}-${swimlane}`}
                      droppableId={`${status}-${swimlane}`}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`min-h-[120px] border-b border-slate-200 p-3 last:border-b-0 ${
                            snapshot.isDraggingOver ? "bg-slate-100" : ""
                          }`}
                        >
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                            {swimlane}
                          </p>
                          {itemsBy(status, swimlane).map((item, index) => {
                            const age = daysSince(item.statusChangedAt)
                            const isStale =
                              (item.swimlane === "EXPEDITE" && age > 1) ||
                              (item.priority === "HIGH" && age > 3) ||
                              age > 7

                            return (
                              <Draggable
                                key={item.id}
                                draggableId={item.id}
                                index={index}
                              >
                                {(dragProvided, dragSnapshot) => (
                                  <article
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className={[
                                      "mb-2 rounded-md border-l-4 bg-white p-3 shadow-sm",
                                      PRIORITY_BORDERS[item.priority],
                                      dragSnapshot.isDragging
                                        ? "shadow-lg"
                                        : "",
                                      isStale ? "ring-2 ring-amber-400" : ""
                                    ].join(" ")}
                                  >
                                    <div className="text-sm font-medium text-slate-900">
                                      {item.title}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                      <span>#{item.humanId.slice(0, 6)}</span>
                                      <span className="flex items-center gap-2">
                                        {isStale && (
                                          <AlertTriangle className="h-3 w-3 text-amber-500" />
                                        )}
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {age}d
                                        </span>
                                      </span>
                                    </div>
                                    {item.labels.length > 0 && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {item.labels.map((label) => (
                                          <span
                                            key={label}
                                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                                          >
                                            {label}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </article>
                                )}
                              </Draggable>
                            )
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  ))}
                </div>
              </section>
            )})}
          </div>
        </DragDropContext>
      </div>
    </div>
  )
}

