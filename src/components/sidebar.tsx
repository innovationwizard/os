"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  PenSquare,
  Filter,
  Layout as LayoutIcon,
  Library,
  Home,
  LogOut,
  User,
  Brain,
  Settings,
  Sparkles
} from "lucide-react"
import { signOut } from "next-auth/react"

const navItems = [
  { href: "/capture", label: "Capture", icon: PenSquare },
  { href: "/clean", label: "Clean", icon: Filter },
  { href: "/workflow", label: "Workflow", icon: LayoutIcon },
  { href: "/library", label: "Compendium", icon: Library },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/", label: "Overview", icon: Home }
]

interface SidebarProps {
  user?: {
    name?: string | null
    role?: string | null
  }
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await signOut({ redirect: false })
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-white">
      <div className="flex items-center gap-3 px-6 py-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
          <Brain className="h-6 w-6 text-slate-700" strokeWidth={1.5} />
        </span>
        <div>
          <div className="text-sm font-semibold tracking-wide text-slate-500">
            OCD
          </div>
          <div className="text-lg font-semibold text-slate-900">
            Opus Corpus Documenter
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <ul className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/"
                ? pathname === href
                : pathname?.startsWith(href)

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t px-4 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
            <User className="h-4 w-4 text-slate-500" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-900">
              {user?.name ?? "Signed in"}
            </div>
            {user?.role && (
              <div className="truncate text-xs text-slate-500">
                {user.role}
              </div>
            )}
          </div>
        </div>
        <Link
          href="/account"
          className={[
            "mt-4 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
            pathname === "/account"
              ? "bg-slate-100 text-slate-900"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          ].join(" ")}
        >
          <Settings className="h-4 w-4" />
          Account
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

