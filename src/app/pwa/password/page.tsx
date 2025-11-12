"use client"

import { PasswordForm } from "@/components/password-form"

export default function PWAPasswordPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Account
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Update password
          </h1>
          <p className="text-sm text-slate-500">
            Your new password works everywhere: capture, routing, and the PWA.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <PasswordForm />
        </div>
      </div>
    </div>
  )
}

