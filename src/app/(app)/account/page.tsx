"use client"

import { PasswordForm } from "@/components/password-form"

export default function AccountPage() {
  return (
    <div className="px-6 py-8">
      <div className="max-w-xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Account
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Change password
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Update your password for both the desktop and PWA capture experiences.
          </p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <PasswordForm />
        </div>
      </div>
    </div>
  )
}

