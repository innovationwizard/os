"use client"

import { useState, useEffect } from "react"
import { X, Plus, Edit2, Trash2, Lock, Palette, Type, Tag } from "lucide-react"
import * as LucideIcons from "lucide-react"

interface OpusTypeConfig {
  id: string
  key: string
  label: string
  icon: string
  color: string
  textColor: string
  description: string | null
  isBuiltIn: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    opuses: number
  }
}

interface OpusTypeCrudModalProps {
  isOpen: boolean
  onClose: () => void
}

const COMMON_ICONS = [
  "FolderKanban", "BookOpen", "FileText", "Code", "GraduationCap",
  "Briefcase", "Sparkles", "Search", "Folder", "FolderOpen",
  "File", "FileCode", "Book", "Library", "Archive", "Database"
]

const COLOR_PRESETS = [
  { color: "bg-blue-100", textColor: "text-blue-700" },
  { color: "bg-purple-100", textColor: "text-purple-700" },
  { color: "bg-slate-100", textColor: "text-slate-700" },
  { color: "bg-green-100", textColor: "text-green-700" },
  { color: "bg-amber-100", textColor: "text-amber-700" },
  { color: "bg-rose-100", textColor: "text-rose-700" },
  { color: "bg-indigo-100", textColor: "text-indigo-700" },
  { color: "bg-teal-100", textColor: "text-teal-700" },
  { color: "bg-pink-100", textColor: "text-pink-700" },
  { color: "bg-cyan-100", textColor: "text-cyan-700" }
]

export function OpusTypeCrudModal({ isOpen, onClose }: OpusTypeCrudModalProps) {
  const [types, setTypes] = useState<OpusTypeConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<OpusTypeConfig | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    key: "",
    label: "",
    icon: "FolderKanban",
    color: "bg-blue-100",
    textColor: "text-blue-700",
    description: ""
  })

  useEffect(() => {
    if (isOpen) {
      fetchTypes()
    }
  }, [isOpen])

  async function fetchTypes() {
    setLoading(true)
    try {
      const response = await fetch("/api/opus-types")
      if (!response.ok) throw new Error("Failed to fetch types")
      const data: OpusTypeConfig[] = await response.json()
      setTypes(data)
    } catch (error) {
      console.error("Failed to fetch opus types:", error)
    } finally {
      setLoading(false)
    }
  }

  function handleCreate() {
    setCreating(true)
    setEditing(null)
    setFormData({
      key: "",
      label: "",
      icon: "FolderKanban",
      color: "bg-blue-100",
      textColor: "text-blue-700",
      description: ""
    })
  }

  function handleEdit(type: OpusTypeConfig) {
    setEditing(type)
    setCreating(false)
    setFormData({
      key: type.key,
      label: type.label,
      icon: type.icon,
      color: type.color,
      textColor: type.textColor,
      description: type.description || ""
    })
  }

  function handleCancel() {
    setCreating(false)
    setEditing(null)
    setFormData({
      key: "",
      label: "",
      icon: "FolderKanban",
      color: "bg-blue-100",
      textColor: "text-blue-700",
      description: ""
    })
  }

  async function handleSave() {
    if (!formData.key.trim() || !formData.label.trim()) {
      alert("Key and label are required")
      return
    }

    // Validate key format
    const keyRegex = /^[A-Z][A-Z0-9_]*$/
    if (!keyRegex.test(formData.key.trim().toUpperCase())) {
      alert("Key must be uppercase, start with a letter, and contain only letters, numbers, and underscores")
      return
    }

    try {
      if (creating) {
        const response = await fetch("/api/opus-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: formData.key.trim().toUpperCase(),
            label: formData.label.trim(),
            icon: formData.icon,
            color: formData.color,
            textColor: formData.textColor,
            description: formData.description.trim() || null
          })
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to create type")
        }
      } else if (editing) {
        const response = await fetch(`/api/opus-types/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: formData.label.trim(),
            icon: formData.icon,
            color: formData.color,
            textColor: formData.textColor,
            description: formData.description.trim() || null
          })
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || "Failed to update type")
        }
      }

      await fetchTypes()
      handleCancel()
    } catch (error: any) {
      console.error("Failed to save type:", error)
      alert(error.message || "Failed to save type. Please try again.")
    }
  }

  async function handleDelete(type: OpusTypeConfig) {
    if (type.isBuiltIn) {
      alert("Cannot delete built-in types")
      return
    }

    if (!confirm(`Are you sure you want to delete "${type.label}"? This cannot be undone.`)) {
      return
    }

    if (type._count && type._count.opuses > 0) {
      alert(`Cannot delete type "${type.label}" because ${type._count.opuses} opus(es) are using it.`)
      return
    }

    setDeleting(type.id)
    try {
      const response = await fetch(`/api/opus-types/${type.id}`, {
        method: "DELETE"
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete type")
      }
      await fetchTypes()
    } catch (error: any) {
      console.error("Failed to delete type:", error)
      alert(error.message || "Failed to delete type. Please try again.")
    } finally {
      setDeleting(null)
    }
  }

  function getIconComponent(iconName: string) {
    const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.FolderKanban
    return IconComponent
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">Manage Opus Types</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {creating || editing ? (
            /* Create/Edit Form */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Key {creating ? "*" : ""}
                </label>
                {creating ? (
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                    placeholder="PROJECT_TYPE"
                    pattern="[A-Z][A-Z0-9_]*"
                  />
                ) : (
                  <input
                    type="text"
                    value={formData.key}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-500"
                  />
                )}
                <p className="mt-1 text-xs text-slate-500">
                  Uppercase identifier (e.g., PROJECT, BOOK, CUSTOM_TYPE)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Label *
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                  placeholder="Project Type"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Icon
                </label>
                <select
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  {COMMON_ICONS.map((icon) => {
                    const IconComponent = getIconComponent(icon)
                    return (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    )
                  })}
                </select>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Preview:</span>
                  {(() => {
                    const IconComponent = getIconComponent(formData.icon)
                    return <IconComponent className="w-4 h-4" />
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Color Scheme
                </label>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {COLOR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: preset.color, textColor: preset.textColor })}
                      className={`p-3 rounded-md border-2 ${
                        formData.color === preset.color
                          ? "border-slate-900"
                          : "border-slate-200"
                      } ${preset.color} ${preset.textColor}`}
                    >
                      <div className="w-4 h-4 rounded bg-current" />
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className={`px-3 py-1.5 rounded text-xs font-medium ${formData.color} ${formData.textColor}`}>
                    Preview
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500"
                  placeholder="Optional description..."
                />
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
            <div className="text-center py-8 text-slate-500">Loading types...</div>
          ) : types.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No types found.</div>
          ) : (
            /* Type List */
            <div className="space-y-2">
              {types.map((type) => {
                const IconComponent = getIconComponent(type.icon)
                return (
                  <div
                    key={type.id}
                    className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${type.color} ${type.textColor}`}>
                            <IconComponent className="w-3 h-3" />
                            {type.label}
                          </div>
                          {type.isBuiltIn && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Built-in
                            </span>
                          )}
                          {!type.isActive && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-rose-100 text-rose-700">
                              Inactive
                            </span>
                          )}
                          <span className="text-xs text-slate-500 font-mono">{type.key}</span>
                        </div>
                        {type.description && (
                          <p className="text-sm text-slate-600 mb-2">{type.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          {type._count && (
                            <span>{type._count.opuses} opus(es)</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {!type.isBuiltIn && (
                          <>
                            <button
                              onClick={() => handleEdit(type)}
                              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(type)}
                              disabled={deleting === type.id || (type._count && type._count.opuses > 0)}
                              className="p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              title={type._count && type._count.opuses > 0 ? "Cannot delete: has opuses" : "Delete"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!creating && !editing && (
          <div className="p-4 border-t border-slate-200">
            <button
              onClick={handleCreate}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create New Type
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
