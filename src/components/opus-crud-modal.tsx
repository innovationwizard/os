"use client"

import { useState, useEffect } from "react"
import { X, Plus, Edit2, Trash2, BookOpen, Code, GraduationCap, Briefcase, FileText, FolderKanban, Search, Sparkles, Zap, Settings } from "lucide-react"
import { OpusTypeCrudModal } from "./opus-type-crud-modal"
import * as LucideIcons from "lucide-react"

interface OpusTypeConfig {
  key: string
  label: string
  icon: string
  color: string
  textColor: string
}

interface Opus {
  id: string
  name: string
  content: string
  raisonDetre: string
  opusType: string
  isStrategic: boolean
  isDynamic: boolean
  createdAt: string
  updatedAt: string
  _count: {
    items: number
  }
}

interface OpusCrudModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect?: (opus: Opus) => void
  filterType?: string | null
}

export function OpusCrudModal({ isOpen, onClose, onSelect, filterType }: OpusCrudModalProps) {
  const [opuses, setOpuses] = useState<Opus[]>([])
  const [typeConfigs, setTypeConfigs] = useState<OpusTypeConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Opus | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(filterType || null)
  const [showTypeModal, setShowTypeModal] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    raisonDetre: "",
    opusType: "PROJECT",
    isStrategic: false,
    isDynamic: false
  })
  
  // Quick edit state for raison d'être
  const [editingRaisonDetre, setEditingRaisonDetre] = useState<string | null>(null)
  const [raisonDetreValue, setRaisonDetreValue] = useState("")

  useEffect(() => {
    if (isOpen) {
      fetchOpuses()
      fetchTypeConfigs()
    }
  }, [isOpen, selectedTypeFilter])

  async function fetchTypeConfigs() {
    try {
      const response = await fetch("/api/opus-types")
      if (!response.ok) throw new Error("Failed to fetch type configs")
      const data = await response.json()
      setTypeConfigs(data)
    } catch (error) {
      console.error("Failed to fetch opus type configs:", error)
    }
  }

  async function handleTypeModalClose() {
    setShowTypeModal(false)
    await fetchTypeConfigs() // Refresh type configs after changes
  }

  function getTypeConfig(typeKey: string): OpusTypeConfig | null {
    return typeConfigs.find(t => t.key === typeKey) || null
  }

  function getIconComponent(iconName: string) {
    const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.FolderKanban
    return IconComponent
  }

  async function fetchOpuses() {
    setLoading(true)
    try {
      const url = selectedTypeFilter
        ? `/api/opuses?opusType=${selectedTypeFilter}`
        : "/api/opuses"
      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to fetch opuses")
      const data: Opus[] = await response.json()
      setOpuses(data)
    } catch (error) {
      console.error("Failed to fetch opuses:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleCreate() {
    setCreating(true)
    setEditing(null)
    setFormData({
      name: "",
      content: "",
      raisonDetre: "",
      opusType: selectedTypeFilter || "PROJECT",
      isStrategic: false,
      isDynamic: false
    })
  }

  function handleEdit(opus: Opus) {
    setEditing(opus)
    setCreating(false)
    setFormData({
      name: opus.name,
      content: opus.content,
      raisonDetre: opus.raisonDetre || "",
      opusType: opus.opusType,
      isStrategic: opus.isStrategic,
      isDynamic: opus.isDynamic
    })
  }
  
  function handleStartEditRaisonDetre(opus: Opus) {
    setEditingRaisonDetre(opus.id)
    setRaisonDetreValue(opus.raisonDetre || "")
  }
  
  async function handleSaveRaisonDetre() {
    if (!editingRaisonDetre) return
    
    try {
      const response = await fetch(`/api/opuses/${editingRaisonDetre}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raisonDetre: raisonDetreValue })
      })
      if (!response.ok) throw new Error("Failed to update raison d'être")
      await fetchOpuses()
      setEditingRaisonDetre(null)
      setRaisonDetreValue("")
    } catch (error) {
      console.error("Failed to save raison d'être:", error)
      alert("Failed to save raison d'être. Please try again.")
    }
  }
  
  function handleCancelRaisonDetre() {
    setEditingRaisonDetre(null)
    setRaisonDetreValue("")
  }

  function handleCancel() {
    setCreating(false)
    setEditing(null)
    setFormData({
      name: "",
      content: "",
      raisonDetre: "",
      opusType: "PROJECT",
      isStrategic: false,
      isDynamic: false
    })
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      alert("Name is required")
      return
    }

    try {
      if (creating) {
        const response = await fetch("/api/opuses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        })
        if (!response.ok) throw new Error("Failed to create opus")
      } else if (editing) {
        const response = await fetch(`/api/opuses/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        })
        if (!response.ok) throw new Error("Failed to update opus")
      }

      await fetchOpuses()
      handleCancel()
    } catch (error) {
      console.error("Failed to save opus:", error)
      alert("Failed to save opus. Please try again.")
    }
  }

  async function handleDelete(opus: Opus) {
    if (!confirm(`Are you sure you want to delete "${opus.name}"? This cannot be undone.`)) {
      return
    }

    if (opus._count.items > 0) {
      alert(`Cannot delete opus "${opus.name}" because it has ${opus._count.items} associated item(s).`)
      return
    }

    setDeleting(opus.id)
    try {
      const response = await fetch(`/api/opuses/${opus.id}`, {
        method: "DELETE"
      })
      if (!response.ok) throw new Error("Failed to delete opus")
      await fetchOpuses()
    } catch (error) {
      console.error("Failed to delete opus:", error)
      alert("Failed to delete opus. Please try again.")
    } finally {
      setDeleting(null)
    }
  }

  const filteredOpuses = opuses.filter((opus) => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    const typeConfig = getTypeConfig(opus.opusType)
    return (
      opus.name.toLowerCase().includes(query) ||
      opus.content.toLowerCase().includes(query) ||
      (typeConfig && typeConfig.label.toLowerCase().includes(query))
    )
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">Manage Opuses</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Search */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedTypeFilter(null)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                selectedTypeFilter === null
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Types
            </button>
            {typeConfigs.map((typeConfig) => {
              const Icon = getIconComponent(typeConfig.icon)
              return (
                <button
                  key={typeConfig.key}
                  onClick={() => setSelectedTypeFilter(typeConfig.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 ${
                    selectedTypeFilter === typeConfig.key
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {typeConfig.label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search opuses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            <button
              onClick={() => setShowTypeModal(true)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 flex items-center gap-2"
              title="Manage opus types"
            >
              <Settings className="w-4 h-4" />
              Types
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Opus
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {creating || editing ? (
            /* Create/Edit Form */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                  placeholder="Enter opus name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type
                </label>
                <select
                  value={formData.opusType}
                  onChange={(e) => setFormData({ ...formData, opusType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  {typeConfigs.map((typeConfig) => (
                    <option key={typeConfig.key} value={typeConfig.key}>
                      {typeConfig.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Raison d'être <span className="text-xs text-slate-500">(Why this Opus exists)</span>
                </label>
                <textarea
                  value={formData.raisonDetre}
                  onChange={(e) => setFormData({ ...formData, raisonDetre: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                  placeholder="The most important reason or purpose for this Opus to exist..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Content
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 font-mono text-sm"
                  placeholder="Enter opus content..."
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isStrategic}
                    onChange={(e) => setFormData({ ...formData, isStrategic: e.target.checked })}
                    className="w-4 h-4 text-slate-600 border-slate-300 rounded focus:ring-slate-500"
                  />
                  <span className="text-sm text-slate-700">Strategic</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDynamic}
                    onChange={(e) => setFormData({ ...formData, isDynamic: e.target.checked })}
                    className="w-4 h-4 text-slate-600 border-slate-300 rounded focus:ring-slate-500"
                  />
                  <span className="text-sm text-slate-700">Dynamic</span>
                </label>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800"
                >
                  {creating ? "Create" : "Save"}
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="text-center py-8 text-slate-500">Loading opuses...</div>
          ) : filteredOpuses.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {searchQuery ? "No opuses match your search." : "No opuses found."}
            </div>
          ) : (
            /* Opus List */
            <div className="space-y-2">
              {filteredOpuses.map((opus) => {
                const typeConfig = getTypeConfig(opus.opusType)
                if (!typeConfig) return null
                const Icon = getIconComponent(typeConfig.icon)
                return (
                  <div
                    key={opus.id}
                    className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${typeConfig.color} ${typeConfig.textColor}`}>
                            <Icon className="w-3 h-3" />
                            {typeConfig.label}
                          </div>
                          {opus.isStrategic && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              Strategic
                            </span>
                          )}
                          {opus.isDynamic && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              Dynamic
                            </span>
                          )}
                        </div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-slate-900 flex-1">{opus.name}</h3>
                          {editingRaisonDetre !== opus.id && (
                            <button
                              onClick={() => handleStartEditRaisonDetre(opus)}
                              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                              title="Edit raison d'être"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {editingRaisonDetre === opus.id ? (
                          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                            <label className="block text-xs font-medium text-amber-900 mb-1">
                              Raison d'être
                            </label>
                            <textarea
                              value={raisonDetreValue}
                              onChange={(e) => setRaisonDetreValue(e.target.value)}
                              rows={3}
                              className="w-full px-2 py-1.5 text-sm border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 mb-2"
                              placeholder="The most important reason or purpose for this Opus to exist..."
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveRaisonDetre}
                                className="px-3 py-1 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelRaisonDetre}
                                className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded hover:bg-amber-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : opus.raisonDetre ? (
                          <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                            <div className="text-xs font-medium text-amber-900 mb-1">Raison d'être:</div>
                            <p className="text-sm text-amber-800">{opus.raisonDetre}</p>
                          </div>
                        ) : (
                          <div className="mb-2 p-2 bg-slate-50 border border-dashed border-slate-300 rounded-md">
                            <p className="text-xs text-slate-500 italic">No raison d'être defined. Click the ✨ icon to add one.</p>
                          </div>
                        )}
                        {opus.content && (
                          <p className="text-sm text-slate-600 line-clamp-2 mb-2">{opus.content}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>{opus._count.items} item(s)</span>
                          <span>Created {new Date(opus.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {onSelect && (
                          <button
                            onClick={() => {
                              onSelect(opus)
                              onClose()
                            }}
                            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                            title="Select"
                          >
                            Select
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(opus)}
                          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(opus)}
                          disabled={deleting === opus.id || opus._count.items > 0}
                          className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          title={opus._count.items > 0 ? "Cannot delete: has items" : "Delete"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <OpusTypeCrudModal
        isOpen={showTypeModal}
        onClose={handleTypeModalClose}
      />
    </div>
  )
}
