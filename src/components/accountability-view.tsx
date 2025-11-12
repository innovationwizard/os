"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

interface AccountabilityItem {
  id: string
  title: string
  status: string
  createdAt: string
  statusChangedAt: string
}

export function AccountabilityView() {
  const [items, setItems] = useState<AccountabilityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    setError(null)
    try {
      console.log("[Accountability] Fetching items with capturedBy=me")
      const response = await fetch("/api/items?capturedBy=me", {
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("[Accountability] Failed to load items:", response.status, errorData)
        setError(`Failed to load items: ${response.status} ${errorData.error || ""}`)
        return
      }
      
      const data: AccountabilityItem[] = await response.json()
      console.log(`[Accountability] Loaded ${data.length} items:`, data)
      
      // Ensure all items have statusChangedAt (fallback to createdAt if missing)
      const validItems = data.map(item => ({
        ...item,
        statusChangedAt: item.statusChangedAt || item.createdAt
      }))
      
      console.log(`[Accountability] Setting ${validItems.length} items`)
      setItems(validItems)
    } catch (error) {
      console.error("[Accountability] Error fetching items:", error)
      setError(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  function getDaysSince(date: string) {
    return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "DONE":
        return "text-emerald-600"
      case "CREATE":
        return "text-blue-600"
      case "TODO":
        return "text-slate-600"
      case "INBOX":
        return "text-amber-600"
      case "ON_HOLD":
        return "text-yellow-600"
      default:
        return "text-slate-500"
    }
  }

  function formatStatus(status: string) {
    return status.replace(/_/g, " ")
  }

  function getDaysInStatus(statusChangedAt: string) {
    return Math.floor((Date.now() - new Date(statusChangedAt).getTime()) / (1000 * 60 * 60 * 24))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Step 2: Follow up on your commands
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Status:
          </h1>
        </header>
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading your items...
        </div>
      </div>
    )
  }

  if (items.length === 0 && !loading) {
    return (
      <div className="space-y-4">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Step 2: Follow up on your commands
          </p>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            Status:
          </h1>
        </header>
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          {error ? (
            <div className="space-y-2">
              <p className="text-sm text-red-600 font-medium">{error}</p>
              <button
                type="button"
                onClick={() => void fetchItems()}
                className="mt-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Try again
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No items captured yet.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Step 2: Follow up on your commands
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          Status:
        </h1>
      </header>

      <div className="space-y-3">
        {items.map((item) => {
          const daysSinceCreation = getDaysSince(item.createdAt)
          const daysInStatus = getDaysInStatus(item.statusChangedAt)
          const formattedStatus = formatStatus(item.status)

          return (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-slate-900 truncate">
                    {item.title}
                  </h3>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${getStatusColor(item.status)}`}>
                        Status: {formattedStatus}, since {daysInStatus} {daysInStatus === 1 ? "day" : "days"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {daysSinceCreation} {daysSinceCreation === 1 ? "day" : "days"} since creation
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

