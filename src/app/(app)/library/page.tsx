"use client"

import { useEffect, useState, useMemo } from "react"
import { BookOpen, Calendar, Tag, Plus, Edit2, Save, X, Trash2, Search } from "lucide-react"

interface Item {
  id: string
  title: string
  rawInstructions: string
  labels: string[]
  createdAt: string
}

interface SearchMatch {
  item: Item
  matchType: "title" | "content" | "both"
  titleMatch?: string
  contentPreview?: string
}

export default function LibraryPage() {
  const [items, setItems] = useState<Item[]>([])
  const [selected, setSelected] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    loadLibrary()
  }, [])

  // Smart search with suggestions
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return []
    }

    const query = searchQuery.toLowerCase().trim()
    const queryWords = query.split(/\s+/).filter(Boolean)
    const results: SearchMatch[] = []

    for (const item of items) {
      const titleLower = item.title.toLowerCase()
      const contentLower = item.rawInstructions.toLowerCase()
      
      // Check if all query words match
      const titleMatches = queryWords.every(word => titleLower.includes(word))
      const contentMatches = queryWords.every(word => contentLower.includes(word))
      
      if (titleMatches || contentMatches) {
        let matchType: "title" | "content" | "both" = "content"
        let titleMatch: string | undefined
        let contentPreview: string | undefined

        if (titleMatches && contentMatches) {
          matchType = "both"
          titleMatch = item.title
          // Find first occurrence of query in content
          const firstMatchIndex = contentLower.indexOf(queryWords[0])
          const start = Math.max(0, firstMatchIndex - 50)
          const end = Math.min(contentLower.length, firstMatchIndex + query.length + 100)
          contentPreview = item.rawInstructions.slice(start, end)
          if (start > 0) contentPreview = "..." + contentPreview
          if (end < contentLower.length) contentPreview = contentPreview + "..."
        } else if (titleMatches) {
          matchType = "title"
          titleMatch = item.title
          // Show beginning of content
          contentPreview = item.rawInstructions.slice(0, 150)
          if (item.rawInstructions.length > 150) contentPreview += "..."
        } else {
          // Content match - find snippet around match
          const firstMatchIndex = contentLower.indexOf(queryWords[0])
          const start = Math.max(0, firstMatchIndex - 50)
          const end = Math.min(contentLower.length, firstMatchIndex + query.length + 100)
          contentPreview = item.rawInstructions.slice(start, end)
          if (start > 0) contentPreview = "..." + contentPreview
          if (end < contentLower.length) contentPreview = contentPreview + "..."
        }

        results.push({
          item,
          matchType,
          titleMatch,
          contentPreview
        })
      }
    }

    // Sort by relevance: both > title > content, then by title
    results.sort((a, b) => {
      const typeOrder = { both: 0, title: 1, content: 2 }
      const typeDiff = typeOrder[a.matchType] - typeOrder[b.matchType]
      if (typeDiff !== 0) return typeDiff
      return a.item.title.localeCompare(b.item.title)
    })

    return results.slice(0, 8) // Limit to 8 suggestions
  }, [searchQuery, items])

  function highlightMatch(text: string, query: string): string {
    if (!query.trim()) return text
    const queryWords = query.trim().split(/\s+/).filter(Boolean)
    let highlighted = text
    for (const word of queryWords) {
      const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 font-medium">$1</mark>')
    }
    return highlighted
  }

  useEffect(() => {
    if (selected && !editing && !creating) {
      setEditTitle(selected.title)
      setEditContent(selected.rawInstructions)
    }
  }, [selected, editing, creating])

  async function loadLibrary() {
    setLoading(true)
    try {
      const response = await fetch("/api/items?status=COMPENDIUM")
      const data: Item[] = await response.json()
      setItems(data)
      setSelected((current) =>
        current ? data.find((item) => item.id === current.id) ?? null : null
      )
    } finally {
      setLoading(false)
    }
  }

  function startEditing() {
    if (!selected) return
    setEditing(true)
    setEditTitle(selected.title)
    setEditContent(selected.rawInstructions)
  }

  function cancelEditing() {
    setEditing(false)
    setCreating(false)
    if (selected) {
      setEditTitle(selected.title)
      setEditContent(selected.rawInstructions)
    } else {
      setEditTitle("")
      setEditContent("")
    }
  }

  function startCreating() {
    setCreating(true)
    setEditing(false)
    setSelected(null)
    setEditTitle("")
    setEditContent("")
  }

  async function saveItem() {
    if (!editTitle.trim() || !editContent.trim()) {
      alert("Title and content are required")
      return
    }

    setSaving(true)
    try {
      if (creating) {
        // Create new compendium item
        const response = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle.trim(),
            content: editContent.trim(),
            status: "COMPENDIUM",
            type: "INFO"
          })
        })

        if (!response.ok) {
          throw new Error("Failed to create item")
        }

        const newItem: Item = await response.json()
        await loadLibrary()
        setSelected(newItem)
        setCreating(false)
        setEditing(false)
      } else if (selected) {
        // Update existing item
        const response = await fetch(`/api/items/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle.trim(),
            rawInstructions: editContent.trim()
          })
        })

        if (!response.ok) {
          throw new Error("Failed to update item")
        }

        await loadLibrary()
        setEditing(false)
      }
    } catch (error) {
      console.error("Failed to save item", error)
      alert("Failed to save item. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem() {
    if (!selected) return

    if (!confirm(`Are you sure you want to delete "${selected.title}"?`)) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/items/${selected.id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        throw new Error("Failed to delete item")
      }

      await loadLibrary()
      setSelected(null)
      setEditing(false)
    } catch (error) {
      console.error("Failed to delete item", error)
      alert("Failed to delete item. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return items
    }
    return searchResults.map(result => result.item)
  }, [searchQuery, items, searchResults])

  return (
    <div className="px-8 py-10">
      <div className="space-y-6">
        <header className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
                <BookOpen className="h-5 w-5 text-slate-500" />
                Knowledge Compendium
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Reference material and context captured during work.
              </p>
            </div>
            {!creating && !editing && (
              <button
                type="button"
                onClick={startCreating}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                New Item
              </button>
            )}
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  // Delay hiding suggestions to allow clicks
                  setTimeout(() => setShowSuggestions(false), 200)
                }}
                placeholder="Search compendium items..."
                className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
            
            {/* Suggestions Dropdown */}
            {showSuggestions && searchQuery.trim() && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="max-h-96 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.item.id}
                      type="button"
                      onClick={() => {
                        setSelected(result.item)
                        setSearchQuery("")
                        setShowSuggestions(false)
                      }}
                      className="w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 last:border-b-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div 
                            className="text-sm font-medium text-slate-900"
                            dangerouslySetInnerHTML={{ 
                              __html: highlightMatch(
                                result.titleMatch || result.item.title, 
                                searchQuery
                              )
                            }}
                          />
                          {result.contentPreview && (
                            <div 
                              className="mt-1 text-xs text-slate-600 line-clamp-2"
                              dangerouslySetInnerHTML={{ 
                                __html: highlightMatch(result.contentPreview, searchQuery)
                              }}
                            />
                          )}
                          <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                            <Calendar className="h-3 w-3" />
                            {new Date(result.item.createdAt).toLocaleDateString()}
                            {result.matchType === "title" && (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">
                                Title match
                              </span>
                            )}
                            {result.matchType === "both" && (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                                Title & content
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {searchResults.length >= 8 && (
                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                    Showing top 8 results. Refine your search for more.
                  </div>
                )}
              </div>
            )}
            
            {showSuggestions && searchQuery.trim() && searchResults.length === 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-lg">
                No results found for "{searchQuery}"
              </div>
            )}
          </div>
        </header>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading compendium…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
            <aside className="space-y-2">
              {filteredItems.length === 0 && !creating ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  {searchQuery.trim() ? "No items match your search." : "Nothing saved yet."}
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (!editing && !creating) {
                        setSelected(item)
                      }
                    }}
                    className={[
                      "w-full rounded-md border px-4 py-3 text-left text-sm shadow-sm transition-colors",
                      selected?.id === item.id && !editing && !creating
                        ? "border-slate-400 bg-slate-100 text-slate-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900",
                      editing || creating ? "opacity-50 cursor-not-allowed" : ""
                    ].join(" ")}
                    disabled={editing || creating}
                  >
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.createdAt).toLocaleDateString()}
                      {item.labels.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {item.labels.join(", ")}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </aside>

            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              {creating || editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Enter title..."
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Content
                    </label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="Enter content..."
                      rows={12}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={saveItem}
                      disabled={saving || !editTitle.trim() || !editContent.trim()}
                      className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="h-4 w-4" />
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : selected ? (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selected.title}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={startEditing}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={deleteItem}
                        disabled={deleting}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:border-rose-400 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3 w-3" />
                        {deleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-sm text-slate-700">
                    {selected.rawInstructions}
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  {creating ? (
                    <div>Creating new item...</div>
                  ) : (
                    <div>Select an item to read its details, or create a new one.</div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
