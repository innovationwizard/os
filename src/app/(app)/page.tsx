"use client"

import { useEffect, useState } from "react"
import { Inbox, CheckCircle2, PlayCircle, BarChart3 } from "lucide-react"
import Link from "next/link"
import { DecisionsCounter } from "@/components/decisions-counter"
import { ABTestDashboard } from "@/components/ab-test-dashboard"

interface Stats {
  inbox: number
  inProgress: number
  completed: number
  total: number
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setLoading(true)
    try {
      const response = await fetch("/api/items", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to load stats")
      }
      const items = await response.json()
      
      const stats: Stats = {
        inbox: items.filter((item: { status: string }) => item.status === "INBOX").length,
        inProgress: items.filter((item: { status: string }) => 
          item.status === "CREATING" || item.status === "IN_REVIEW"
        ).length,
        completed: items.filter((item: { status: string }) => item.status === "DONE").length,
        total: items.length
      }
      
      setStats(stats)
    } catch (error) {
      console.error("Failed to load stats", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-8 py-10">
      <div className="max-w-6xl space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-slate-900">
            Welcome to OCD
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Your AI-powered Opus Corpus Documenter system.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/inbox"
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
            prefetch={true}
            onClick={(e) => {
              console.log("Inbox clicked, navigating...")
            }}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-rose-100 p-2">
                <Inbox className="h-5 w-5 text-rose-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-medium text-slate-500">Inbox</h2>
                <p className="mt-1 text-2xl font-semibold text-rose-600">
                  {loading ? "…" : stats?.inbox ?? 0}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Items waiting for choose
            </p>
          </Link>

          <Link
            href="/workflow"
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <PlayCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-medium text-slate-500">In Progress</h2>
                <p className="mt-1 text-2xl font-semibold text-amber-600">
                  {loading ? "…" : stats?.inProgress ?? 0}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Active work items
            </p>
          </Link>

          <Link
            href="/workflow"
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-medium text-slate-500">Completed</h2>
                <p className="mt-1 text-2xl font-semibold text-emerald-600">
                  {loading ? "…" : stats?.completed ?? 0}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Finished items
            </p>
          </Link>

          {/* Training Data Collection Counter */}
          <DecisionsCounter />

      <div className="mt-8">
        <ABTestDashboard />
      </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <BarChart3 className="h-5 w-5 text-slate-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-medium text-slate-500">Total Items</h2>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {loading ? "…" : stats?.total ?? 0}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              All items in system
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/capture"
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <h3 className="text-lg font-semibold text-slate-900">Capture</h3>
            <p className="mt-2 text-sm text-slate-600">
              Capture new ideas, tasks, or information quickly.
            </p>
          </Link>

          <Link
            href="/workflow"
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <h3 className="text-lg font-semibold text-slate-900">Workflow</h3>
            <p className="mt-2 text-sm text-slate-600">
              Manage your active tasks and projects.
            </p>
          </Link>

          <Link
            href="/library"
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <h3 className="text-lg font-semibold text-slate-900">Compendium</h3>
            <p className="mt-2 text-sm text-slate-600">
              Browse your knowledge base and reference materials.
            </p>
          </Link>
        </section>
      </div>
    </div>
  )
}
